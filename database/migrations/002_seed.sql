insert into service_types (slug, name, description, sort_order)
values
  ('tractor', 'شخم و دیسک', 'آماده‌سازی زمین برای کاشت', 1),
  ('planting', 'کاشت', 'بذرپاشی، ردیف‌کاری و نشاکاری', 2),
  ('spray', 'سمپاشی', 'مبارزه با آفات، بیماری‌ها و علف‌های هرز', 3),
  ('harvest', 'برداشت', 'برداشت محصولات با ماشین‌آلات', 4),
  ('transport', 'حمل محصول', 'حمل محصولات کشاورزی با ماشین‌آلات', 5)
on conflict (slug) do nothing;

insert into app_settings (key, value_num, is_public)
values ('commission_rate', 3.000, false)
on conflict (key) do nothing;
