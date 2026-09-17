require('dotenv').config();
const { query, pool } = require('./db');
const { normalizePhone, normalizeNationalId, validPhone, validNationalId } = require('./auth');

async function main() {
  const phone = normalizePhone(process.env.KELO_ADMIN_PHONE);
  const nationalId = normalizeNationalId(process.env.KELO_ADMIN_NATIONAL_ID);
  const name = String(process.env.KELO_ADMIN_NAME || 'مدیر KELO').trim();
  if (!validPhone(phone)) throw new Error('KELO_ADMIN_PHONE is missing/invalid.');
  if (!validNationalId(nationalId)) throw new Error('KELO_ADMIN_NATIONAL_ID is missing/invalid.');

  const existing = await query('select id from users where phone = $1 limit 1', [phone]);
  let result;
  if (existing.rows[0]) {
    result = await query(
      `update users set name = $1, national_id = $2, system_roles = (
        select array_agg(distinct x) from unnest(array_append(system_roles, 'admin')) as x
      ) where id = $3 returning id, phone`,
      [name, nationalId, existing.rows[0].id]
    );
  } else {
    result = await query(
      `insert into users (name, phone, national_id, profile_completed, system_roles)
       values ($1, $2, $3, true, array['admin']::text[])
       returning id, phone`,
      [name, phone, nationalId]
    );
  }
  console.log(`[admin] ready: ${result.rows[0].id} / ${result.rows[0].phone}`);
  await pool.end();
}

main().catch(async error => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
