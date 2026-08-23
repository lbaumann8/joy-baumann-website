import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const NAME_MIN = 2;
const NAME_MAX = 80;
const REVIEW_MAX = 1500;

const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_PER_WINDOW = 3;
const RATE_LIMIT_MIN_INTERVAL_SECONDS = 30;

// Strips ASCII control characters (form input should never legitimately contain these).
const CONTROL_CHARS_RE = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');

let _sql = null;
function getSql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

function hashIp(ip) {
  return createHash('sha256').update(String(ip || 'unknown')).digest('hex');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

function clean(value) {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS_RE, '').trim();
}

function validate(body) {
  const errors = {};

  const name = clean(body.name);
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    errors.name = `Name must be between ${NAME_MIN} and ${NAME_MAX} characters.`;
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    errors.rating = 'Please select a rating between 1 and 5.';
  }

  const reviewText = clean(body.review_text);
  if (reviewText.length === 0) {
    errors.review_text = 'Please write a review before submitting.';
  } else if (reviewText.length > REVIEW_MAX) {
    errors.review_text = `Review must be ${REVIEW_MAX} characters or fewer.`;
  }

  return {
    errors,
    value: { name, rating, reviewText },
  };
}

async function handleGet(req, res) {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, rating, review_text, created_at
    FROM reviews
    WHERE status != 'rejected'
    ORDER BY created_at DESC
    LIMIT 200
  `;

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let total = 0;
  for (const row of rows) {
    breakdown[row.rating] = (breakdown[row.rating] || 0) + 1;
    total += row.rating;
  }
  const count = rows.length;
  const average = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

  res.status(200).json({
    reviews: rows.map((r) => ({
      id: r.id,
      name: r.name,
      rating: r.rating,
      review_text: r.review_text,
      created_at: r.created_at,
    })),
    summary: { average, count, breakdown },
  });
}

async function handlePost(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};

  // Honeypot: bots that fill this hidden field get a fake success, no insert.
  if (clean(body.website)) {
    res.status(201).json({ ok: true });
    return;
  }

  const { errors, value } = validate(body);
  if (Object.keys(errors).length > 0) {
    res.status(400).json({ ok: false, errors });
    return;
  }

  const sql = getSql();
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  const recent = await sql`
    SELECT created_at FROM reviews
    WHERE ip_hash = ${ipHash}
      AND created_at > now() - make_interval(hours => ${RATE_LIMIT_WINDOW_HOURS})
    ORDER BY created_at DESC
  `;

  if (recent.length >= RATE_LIMIT_MAX_PER_WINDOW) {
    res.status(429).json({ ok: false, error: 'Too many reviews submitted recently. Please try again later.' });
    return;
  }

  if (recent.length > 0) {
    const lastSubmitted = new Date(recent[0].created_at).getTime();
    const secondsSince = (Date.now() - lastSubmitted) / 1000;
    if (secondsSince < RATE_LIMIT_MIN_INTERVAL_SECONDS) {
      res.status(429).json({ ok: false, error: 'Please wait a moment before submitting again.' });
      return;
    }
  }

  const [inserted] = await sql`
    INSERT INTO reviews (name, rating, review_text, status, ip_hash)
    VALUES (${value.name}, ${value.rating}, ${value.reviewText}, 'approved', ${ipHash})
    RETURNING id, name, rating, review_text, created_at
  `;

  res.status(201).json({ ok: true, review: inserted });
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
    } else if (req.method === 'POST') {
      await handlePost(req, res);
    } else {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ ok: false, error: 'Method not allowed.' });
    }
  } catch (err) {
    console.error('reviews api error', err);
    res.status(500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
