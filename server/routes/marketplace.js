const { Router } = require('express');
const { pool } = require('../db');

const router = Router();

function auth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ ok: false, error: 'احراز هویت لازم است.' });
  next();
}

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function activityAreaMatchesLocation(activityArea, locationLabel) {
  if (!Array.isArray(activityArea) || !activityArea.length) return true;
  const label = String(locationLabel || '').trim();
  if (!label) return true;
  const norm = v => String(v || '').trim().replace(/\s+/g, '');
  const hay = norm(label);
  for (const row of activityArea) {
    const province = norm(row?.province);
    if (row?.all || !Array.isArray(row?.cities) || row.cities.length === 0) {
      if (!province || hay.includes(province)) return true;
    } else if (row.cities.some(c => hay.includes(norm(c)))) {
      return true;
    }
  }
  return false;
}

function servicePayload(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    sortOrder: row.sort_order
  };
}

function mapListing(row) {
  return {
    id: row.id,
    userId: row.provider_id,
    providerId: row.provider_id,
    providerName: row.provider_name || '',
    service: row.service_slug,
    serviceName: row.service_name || '',
    machineId: row.machine_id,
    machineType: row.machine_type || '',
    capacity: row.capacity || '',
    price: Number(row.price || 0),
    priceUnit: row.price_unit || '',
    activityArea: row.activity_area || [],
    location: row.location_label || '',
    availabilityStart: row.availability_start,
    availabilityEnd: row.availability_end,
    notes: row.notes || '',
    data: {
      ...(row.data || {}),
      machineType: row.machine_type || '',
      capacity: row.capacity || '',
      price: Number(row.price || 0),
      priceUnit: row.price_unit || '',
      activityArea: row.activity_area || [],
      location: row.location_label || '',
      dateStart: row.availability_start,
      dateEnd: row.availability_end,
      note: row.notes || ''
    },
    status: row.status,
    created: row.created_at
  };
}

function computeRequestStatus(row) {
  const s = row.status;
  if (s === 'completed' || s === 'cancelled' || s === 'agreed' || s === 'in_progress') return s;
  let endStr = row.date_end || row.date_start;
  if (!endStr) return s;
  // Date object → ISO string
  if (endStr instanceof Date) {
    try { endStr = endStr.toISOString().slice(0, 10); } catch(e) { return s; }
  } else {
    endStr = String(endStr).trim();
  }
  const parts = endStr.split('-');
  if (parts.length !== 3) return s;
  const endNum = Number(parts[0]) * 10000 + Number(parts[1]) * 100 + Number(parts[2]);
  const t = new Date();
  const todayNum = t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  if (isNaN(endNum)) return s;
  if (endNum < todayNum) return 'expired';
  return s;
}

function mapRequest(row) {
  return {
    id: row.id,
    requestKind: row.request_kind || 'need',
    userId: row.requester_id,
    requesterName: row.requester_name || '',
    service: row.service_slug,
    serviceName: row.service_name || '',
    status: row.status,
    effectiveStatus: computeRequestStatus(row),
    data: {
      ...(row.data || {}),
      area: row.area_ha == null ? undefined : Number(row.area_ha),
      dateStart: row.date_start,
      dateEnd: row.date_end,
      serviceLocation: row.service_location || undefined,
      serviceLocationLabel: row.service_location_label || undefined,
      note: row.note || ''
    },
    created: row.created_at,
    updated: row.updated_at
  };
}

function mapRecipient(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    anchorRequestId: row.anchor_request_id || null,
    sourceRequestId: row.anchor_request_id || null,
    targetRequestId: row.request_id,
    providerId: row.recipient_id || row.provider_id,
    provider: row.proposer_name || row.provider_name || '',
    proposerId: row.proposer_id || row.requester_id || null,
    recipientId: row.recipient_id || row.provider_id,
    proposerName: row.proposer_name || row.provider_name || '',
    recipientName: row.recipient_name || '',
    machineId: row.machine_id,
    listingId: row.listing_id,
    service: row.service_slug,
    unitPrice: Number(row.unit_price || 0),
    priceUnit: row.price_unit || '',
    total: Number(row.total || 0),
    rating: row.rating == null ? null : Number(row.rating),
    location: row.location_label || '',
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at
  };
}

function mapBooking(row) {
  return { id: row.id, requestId: row.request_id, requesterId: row.requester_id, providerId: row.provider_id, machineId: row.machine_id, listingId: row.listing_id, start: row.start_date, end: row.end_date, status: row.status, createdAt: row.created_at };
}

function mapReview(row) {
  return {
    id: row.id,
    dealId: row.deal_id,
    userId: row.author_id,
    targetId: row.target_id,
    ratings: row.ratings || {},
    note: row.note || '',
    createdAt: row.created_at
  };
}
function mapDeal(row) {
  return { id: row.id, requestId: row.request_id, bookingId: row.booking_id, userId: row.requester_id, providerId: row.provider_id, requesterName: row.requester_name || '', requesterPhone: row.requester_phone || '', providerName: row.provider_name || '', providerPhone: row.provider_phone || '', location: row.service_location_label || '', dateStart: row.date_start || null, dateEnd: row.date_end || null, requestData: row.request_data || null, requestArea: row.request_area == null ? null : Number(row.request_area), requestLocation: row.request_location || null, providerMachineType: row.provider_machine_type || '', machineId: row.machine_id, service: row.service_slug, total: Number(row.total || 0), unitPrice: Number(row.unit_price || 0), priceUnit: row.price_unit || '', commissionRate: Number(row.commission_rate || 0), commissionAmount: Number(row.commission_amount || 0), providerAmount: Number(row.provider_amount || 0), paymentStatus: row.payment_status, status: row.status, createdAt: row.created_at, cancelledAt: row.cancelled_at, completedAt: row.completed_at };
}

async function getServiceId(client, slug) {
  const r = await client.query('select id from service_types where slug=$1 and is_active=true', [String(slug || '')]);
  return r.rows[0]?.id || null;
}

let _closingExpired = false;
async function closeExpiredRecipients() {
  if (_closingExpired) return; // don't overlap runs if one is still in flight
  _closingExpired = true;
  try {
    const result = await pool.query(`
      UPDATE request_recipients
      SET status = 'closed', closed_at = NOW()
      WHERE status = 'pending'
        AND request_id IN (
          SELECT id FROM requests
          WHERE status NOT IN ('accepted', 'in_progress', 'completed', 'cancelled', 'expired')
            AND COALESCE(date_end, date_start) < CURRENT_DATE
        )
    `);
    if (result.rowCount > 0) {
      console.log('closeExpiredRecipients: closed ' + result.rowCount + ' pending recipient(s)');
    }
  } catch (e) {
    console.error('closeExpiredRecipients failed:', e.message);
  } finally {
    _closingExpired = false;
  }
}

// Runs on a timer instead of on every getSnapshot() call — this used to run
// once per API request (bootstrap, every mutation, ...), which meant an
// UPDATE statement on nearly every request just to catch a handful of
// requests whose date has passed. Once every 5 minutes is more than enough
// for something that only depends on the calendar date, not the second.
const CLOSE_EXPIRED_INTERVAL_MS = 5 * 60 * 1000;
closeExpiredRecipients();
const _closeExpiredTimer = setInterval(closeExpiredRecipients, CLOSE_EXPIRED_INTERVAL_MS);
if (typeof _closeExpiredTimer.unref === 'function') _closeExpiredTimer.unref();

async function getSnapshot(userId) {
  const [requests, listings, recipients, bookings, deals, payments, machines, reviews] = await Promise.all([
    pool.query(`select r.*, p.full_name requester_name, s.slug service_slug, s.name service_name
      from requests r join service_types s on s.id=r.service_type_id left join profiles p on p.user_id=r.requester_id
      where r.requester_id=$1 or r.status in ('created','matching','sent','pending') order by r.created_at desc`, [userId]),
    pool.query(`select l.*, p.full_name provider_name, s.slug service_slug, s.name service_name
      from service_listings l join service_types s on s.id=l.service_type_id left join profiles p on p.user_id=l.provider_id
      where l.status='active' or l.provider_id=$1 order by l.created_at desc`, [userId]),
    pool.query(`select rr.*, r.requester_id, p1.full_name proposer_name, p2.full_name recipient_name, p2.full_name provider_name, s.slug service_slug, coalesce(m.location_label,l.location_label) location_label
      from request_recipients rr join requests r on r.id=rr.request_id join service_types s on s.id=r.service_type_id
      left join profiles p1 on p1.user_id=coalesce(rr.proposer_id, r.requester_id)
      left join profiles p2 on p2.user_id=coalesce(rr.recipient_id, rr.provider_id)
      left join machines m on m.id=rr.machine_id left join service_listings l on l.id=rr.listing_id
      where r.requester_id=$1 or coalesce(rr.proposer_id, r.requester_id)=$1 or coalesce(rr.recipient_id, rr.provider_id)=$1 order by rr.created_at desc`, [userId]),
    pool.query(`select * from bookings where requester_id=$1 or provider_id=$1 order by created_at desc`, [userId]),
    pool.query(`select d.*, s.slug service_slug, pr.full_name requester_name, ur.phone requester_phone, pp.full_name provider_name, up.phone provider_phone, r.date_start, r.date_end, r.service_location_label, r.data request_data, r.area_ha request_area, r.service_location request_location, (select data->>'machineType' from requests where requester_id = d.provider_id and request_kind='provide' and service_type_id = d.service_type_id and status != 'cancelled' order by created_at desc limit 1) as provider_machine_type from deals d join service_types s on s.id=d.service_type_id left join profiles pr on pr.user_id=d.requester_id left join users ur on ur.id=d.requester_id left join profiles pp on pp.user_id=d.provider_id left join users up on up.id=d.provider_id left join requests r on r.id=d.request_id where d.requester_id=$1 or d.provider_id=$1 order by d.created_at desc`, [userId]),
    pool.query(`select * from payments where payer_id=$1 order by created_at desc`, [userId]),
    pool.query(`select m.*, p.full_name owner_name from machines m left join profiles p on p.user_id=m.owner_id where m.status='active' or m.owner_id=$1 order by m.created_at desc`, [userId]),
    pool.query(`select r.* from reviews r where r.target_id=$1 or r.author_id=$1 order by r.created_at desc`, [userId])
  ]);
  return {
    requests: requests.rows.map(mapRequest),
    listings: listings.rows.map(mapListing),
    requestRecipients: recipients.rows.map(mapRecipient),
    bookings: bookings.rows.map(mapBooking),
    deals: deals.rows.map(mapDeal),
    payments: payments.rows.map(x => ({ id:x.id, dealId:x.deal_id, userId:x.payer_id, amount:Number(x.amount), status:x.status, createdAt:x.created_at, gatewayReference:x.gateway_reference })),
    machines: machines.rows.map(x => ({ id:x.id, ownerId:x.owner_id, owner:x.owner_name || '', type:x.machine_type, location:x.location_label || '', rating:Number(x.rating || 0), jobs:Number(x.completed_jobs || 0), services:{} })),
    reviews: reviews.rows.map(mapReview)
  };
}

router.post('/reviews', auth, async(req,res,next)=>{
  try{
    const b = req.body || {};
    const dealId = String(b.dealId || '');
    const ratings = b.ratings && typeof b.ratings === 'object' ? b.ratings : {};
    const note = String(b.note || '').slice(0, 2000);
    if(!dealId){ return res.status(400).json({ok:false,error:'شناسه توافق مشخص نشده.'}); }
    const answeredCount = Object.keys(ratings).length;
    if(answeredCount === 0 && !note){ return res.status(400).json({ok:false,error:'حداقل یک امتیاز یا نظر لازم است.'}); }

    const deal = (await pool.query("select * from deals where id=$1 and (requester_id=$2 or provider_id=$2) and status='completed'", [dealId, req.session.userId])).rows[0];
    if(!deal){ return res.status(404).json({ok:false,error:'فقط پس از تکمیل کار می‌توانید نظر ثبت کنید.'}); }

    const isFarmer = String(deal.requester_id) === String(req.session.userId);
    const targetId = isFarmer ? deal.provider_id : deal.requester_id;

    const existing = await pool.query('select id from reviews where deal_id=$1 and author_id=$2', [dealId, req.session.userId]);
    if(existing.rowCount){ return res.status(409).json({ok:false,error:'قبلاً برای این توافق گزارش ثبت کرده‌اید.'}); }

    // Sanitize ratings: only keep numbers 1-5
    const cleanRatings = {};
    Object.keys(ratings).forEach(function(k){
      const v = Number(ratings[k]);
      if(v >= 1 && v <= 5) cleanRatings[k] = v;
    });

    await pool.query(
      'insert into reviews(deal_id,author_id,target_id,ratings,note) values($1,$2,$3,$4::jsonb,$5)',
      [dealId, req.session.userId, targetId, JSON.stringify(cleanRatings), note]
    );

    res.status(201).json({ok:true, data:await getSnapshot(req.session.userId)});
  } catch(e){ next(e); }
});
router.get('/bootstrap', auth, async (req, res, next) => {
  try { res.json({ ok: true, data: await getSnapshot(req.session.userId) }); } catch (e) { next(e); }
});

router.get('/services', async (_req, res, next) => {
  try { const r=await pool.query('select id,slug,name,description,sort_order from service_types where is_active=true order by sort_order,name'); res.json({ok:true,services:r.rows.map(servicePayload)}); } catch(e){next(e);}
});

router.post('/requests', auth, async (req, res, next) => {
  const body=req.body||{}; const client=await pool.connect();
  try {
    const serviceId=await getServiceId(client, body.service);
    if(!serviceId) return res.status(400).json({ok:false,error:'نوع خدمت معتبر نیست.'});
    const data=body.data && typeof body.data==='object' ? body.data : {};
    const requestKind = body.requestKind === 'provide' ? 'provide' : 'need';
    const start=String(data.dateStart || data.date || '').trim();
    const end=data.dateEnd ? String(data.dateEnd).trim() : null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start)) return res.status(400).json({ok:false,error:'تاریخ شروع معتبر نیست.'});
    if(end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return res.status(400).json({ok:false,error:'تاریخ پایان معتبر نیست.'});
    const area=data.area != null ? asNumber(data.area) : null;
    if(area !== null && area <= 0) return res.status(400).json({ok:false,error:'مساحت معتبر نیست.'});
    const loc=data.serviceLocation && typeof data.serviceLocation==='object' ? data.serviceLocation : null;
    const inserted=await client.query(`insert into requests(requester_id,request_kind,service_type_id,area_ha,date_start,date_end,service_location,service_location_label,data,note,status)
      values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,'pending') returning id`, [req.session.userId,requestKind,serviceId,area,start,end,loc?JSON.stringify(loc):null,data.serviceLocationLabel||null,JSON.stringify(data),data.note||'']);
    const snap=await getSnapshot(req.session.userId);
    res.status(201).json({ok:true,id:inserted.rows[0].id,data:snap});
  } catch(e){next(e);} finally{client.release();}
});

router.patch('/requests/:id', auth, async (req,res,next)=>{
  const client=await pool.connect();
  try{
    const body=req.body||{}; const current=await client.query('select * from requests where id=$1 and requester_id=$2 for update',[req.params.id,req.session.userId]);
    if(!current.rows[0]) return res.status(404).json({ok:false,error:'درخواست پیدا نشد.'});
    if(['accepted','agreed','in_progress','completed','cancelled','expired'].includes(current.rows[0].status)) return res.status(409).json({ok:false,error:'این درخواست دیگر قابل ویرایش نیست.'});
    const data=body.data && typeof body.data==='object' ? body.data : current.rows[0].data;
    const service=body.service || (await client.query('select slug from service_types where id=$1',[current.rows[0].service_type_id])).rows[0]?.slug;
    const serviceId=await getServiceId(client,service); if(!serviceId) return res.status(400).json({ok:false,error:'نوع خدمت معتبر نیست.'});
    await client.query('begin');
    await client.query(`update requests set service_type_id=$1,area_ha=$2,date_start=$3,date_end=$4,service_location=$5::jsonb,service_location_label=$6,data=$7::jsonb,note=$8,status='pending' where id=$9`,[serviceId,data.area?asNumber(data.area):null,data.dateStart||data.date,data.dateEnd||null,data.serviceLocation?JSON.stringify(data.serviceLocation):null,data.serviceLocationLabel||null,JSON.stringify(data),data.note||'',req.params.id]);
    // بعد از ویرایش همه پیشنهادهای قبلی پاک شوند (مثل Local)
    await client.query(`update request_recipients set status='closed', closed_at=now() where (request_id=$1 or anchor_request_id=$1) and status in ('pending','accepted')`,[req.params.id]);
    await client.query('commit');
    res.json({ok:true,data:await getSnapshot(req.session.userId)});
  }catch(e){try{await client.query('rollback')}catch(_){} next(e)}finally{client.release()}
});

router.delete('/requests/:id', auth, async (req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('begin');
    const r=await client.query(`update requests set status='cancelled', updated_at=now() where id=$1 and requester_id=$2 and status not in ('accepted','in_progress','completed','cancelled') returning id`,[req.params.id,req.session.userId]);
    if(!r.rowCount){await client.query('rollback');return res.status(404).json({ok:false,error:'درخواست پیدا نشد یا قابل حذف نیست.'});}
    // Keep the request for history (soft delete) and close any still-active proposals.
    await client.query(`update request_recipients set status='closed', closed_at=now() where (request_id=$1 or anchor_request_id=$1) and status in ('pending','accepted')`,[req.params.id]);
    await client.query('commit');
    res.json({ok:true,data:await getSnapshot(req.session.userId)});
  }catch(e){try{await client.query('rollback')}catch(_){} next(e)}finally{client.release()}
});

router.post('/listings', auth, async (req,res,next)=>{
  const body=req.body||{}, data=body.data&&typeof body.data==='object'?body.data:{}; const client=await pool.connect();
  try{const serviceId=await getServiceId(client,body.service); if(!serviceId)return res.status(400).json({ok:false,error:'نوع خدمت معتبر نیست.'}); const price=asNumber(data.price); if(price<0)return res.status(400).json({ok:false,error:'قیمت معتبر نیست.'}); const machineId=data.machineId||null; if(machineId){const m=await client.query('select id from machines where id=$1 and owner_id=$2',[machineId,req.session.userId]);if(!m.rowCount)return res.status(403).json({ok:false,error:'ماشین متعلق به این حساب نیست.'});}
    const r=await client.query(`insert into service_listings(provider_id,service_type_id,machine_id,machine_type,capacity,price,price_unit,activity_area,location_label,availability_start,availability_end,notes,data,status)
      values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb,'active') returning id`,[req.session.userId,serviceId,machineId,data.machineType||null,data.capacity||null,price,data.priceUnit||'',JSON.stringify(data.activityArea||[]),data.location||data.locationLabel||null,data.dateStart||null,data.dateEnd||null,data.note||'',JSON.stringify(data||{})]);
    res.status(201).json({ok:true,id:r.rows[0].id,data:await getSnapshot(req.session.userId)});
  }catch(e){next(e)}finally{client.release()}
});

router.patch('/listings/:id', auth, async(req,res,next)=>{try{const body=req.body||{},data=body.data||{};const r=await pool.query(`update service_listings l set machine_type=$1,capacity=$2,price=$3,price_unit=$4,activity_area=$5::jsonb,location_label=$6,availability_start=$7,availability_end=$8,notes=$9,data=$10::jsonb where l.id=$11 and l.provider_id=$12 returning l.id`,[data.machineType||null,data.capacity||null,asNumber(data.price),data.priceUnit||'',JSON.stringify(data.activityArea||[]),data.location||data.locationLabel||null,data.dateStart||null,data.dateEnd||null,data.note||'',JSON.stringify(data||{}),req.params.id,req.session.userId]);if(!r.rowCount)return res.status(404).json({ok:false,error:'خدمت پیدا نشد.'});res.json({ok:true,data:await getSnapshot(req.session.userId)})}catch(e){next(e)}});
router.delete('/listings/:id',auth,async(req,res,next)=>{try{const r=await pool.query(`update service_listings set status='blocked' where id=$1 and provider_id=$2 returning id`,[req.params.id,req.session.userId]);if(!r.rowCount)return res.status(404).json({ok:false,error:'خدمت پیدا نشد.'});res.json({ok:true,data:await getSnapshot(req.session.userId)})}catch(e){next(e)}});

router.get('/requests/:id/providers',auth,async(req,res,next)=>{try{
  const r=await pool.query(`select r.*,s.slug service_slug from requests r join service_types s on s.id=r.service_type_id where r.id=$1 and r.requester_id=$2`,[req.params.id,req.session.userId]);
  if(!r.rows[0]) return res.status(404).json({ok:false,error:'درخواست پیدا نشد.'});
  const request=r.rows[0];
  const out=[];

  if(request.request_kind==='need'){
    // Need -> active service listings only. A "provide" request is not mixed
    // into this side of the matching model.
    const listings=await pool.query(`select l.id listing_id,l.provider_id,l.machine_id,l.machine_type,l.capacity,l.price,l.price_unit,l.activity_area,l.location_label,l.availability_start,l.availability_end,l.data listing_data,p.full_name provider_name,s.slug service_slug
      from service_listings l join service_types s on s.id=l.service_type_id left join profiles p on p.user_id=l.provider_id
      where l.status='active' and l.provider_id<>$1 and l.service_type_id=$2
        and (l.availability_start is null or l.availability_start <= $3)
        and (l.availability_end is null or l.availability_end >= coalesce($4,$3))
        and not exists (
          select 1 from bookings b
          where b.provider_id=l.provider_id
            and b.status in ('confirmed','in_progress')
            and daterange(b.start_date,b.end_date,'[]') && daterange($3,coalesce($4,$3),'[]')
            and (l.machine_id is null or b.machine_id=l.machine_id)
        )
      order by l.price asc,l.created_at desc`,[request.requester_id,request.service_type_id,request.date_start,request.date_end]);
    listings.rows.forEach(x=>{ out.push({providerId:x.provider_id,provider:x.provider_name||'ارائه‌دهنده',machineId:x.machine_id,listingId:x.listing_id,service:x.service_slug,unitPrice:Number(x.price),priceUnit:x.price_unit,rating:null,location:x.location_label||'',targetRequestId:request.id,offerKey:String(x.provider_id)+'|'+String(request.id),data:Object.assign({}, x.listing_data||{}, {machineType:x.machine_type||'',capacity:x.capacity||'',price:Number(x.price),priceUnit:x.price_unit,activityArea:x.activity_area||[],dateStart:x.availability_start,dateEnd:x.availability_end})}); });
  }else{
    // Provide -> specific active need requests. The target request id is
    // returned explicitly; there is no "latest need" fallback.
    const needs=await pool.query(`select r.id request_id,r.requester_id,p.full_name requester_name,s.slug service_slug,r.data,r.area_ha,r.date_start,r.date_end,r.service_location,r.service_location_label
      from requests r join service_types s on s.id=r.service_type_id left join profiles p on p.user_id=r.requester_id
      where r.request_kind='need' and r.status not in ('cancelled','completed','expired') and r.requester_id<>$1 and r.service_type_id=$2
        and (r.date_start >= $3)
        and (coalesce(r.date_end,r.date_start) <= coalesce($4,$3))
        and not exists (
          select 1 from bookings b
          where b.provider_id=$1
            and b.status in ('confirmed','in_progress')
            and daterange(b.start_date,b.end_date,'[]') && daterange(r.date_start,coalesce(r.date_end,r.date_start),'[]')
        )
      order by r.created_at desc`,[request.requester_id,request.service_type_id,request.date_start,request.date_end]);
    needs.rows.forEach(x=>{ out.push({providerId:x.requester_id,provider:x.requester_name||'درخواست‌دهنده',machineId:null,listingId:null,service:x.service_slug,unitPrice:Number(request.data?.price||0),priceUnit:request.data?.priceUnit||'',rating:null,location:x.service_location_label||'',targetRequestId:x.request_id,offerKey:String(x.requester_id)+'|'+String(x.request_id),data:{...(x.data||{}),area:x.area_ha==null?undefined:Number(x.area_ha),dateStart:x.date_start,dateEnd:x.date_end,serviceLocation:x.service_location||undefined,serviceLocationLabel:x.service_location_label||undefined,requestId:x.request_id,requestKind:'need',sourceRequestId:request.id,providerPrice:Number(request.data?.price||0),providerPriceUnit:request.data?.priceUnit||''}}); });
  }
  res.json({ok:true,providers:out});
}catch(e){next(e)}});

router.post('/requests/:id/recipients',auth,async(req,res,next)=>{const client=await pool.connect();try{
  const b=req.body||{};
  const sourceResult=await client.query(`select r.*,s.slug service_slug from requests r join service_types s on s.id=r.service_type_id where r.id=$1 for update`,[req.params.id]);
  if(!sourceResult.rows[0]) return res.status(404).json({ok:false,error:'درخواست پیدا نشد.'});
  const sourceRequest=sourceResult.rows[0];
  const proposerId=req.session.userId;
  const recipientId=String(b.recipientId||b.providerId||'');
  if(!recipientId)return res.status(400).json({ok:false,error:'گیرنده پیشنهاد مشخص نشده است.'});
  if(recipientId===proposerId)return res.status(400).json({ok:false,error:'ارسال پیشنهاد به خودتان مجاز نیست.'});
  if(String(sourceRequest.requester_id)!==String(proposerId)) return res.status(403).json({ok:false,error:'فقط صاحب درخواست می‌تواند از این درخواست پیشنهاد ارسال کند.'});

  let targetRequest=sourceRequest;
  let anchorRequestId=null;
  if(sourceRequest.request_kind==='provide'){
    anchorRequestId=sourceRequest.id;
    const targetId=String(b.targetRequestId||'');
    if(!targetId) return res.status(400).json({ok:false,error:'درخواست نیازِ متناظر مشخص نشده است.'});
    const q=await client.query(`select r.*,s.slug service_slug from requests r join service_types s on s.id=r.service_type_id where r.id=$1 and r.request_kind='need' and r.requester_id=$2 for update`,[targetId,recipientId]);
    if(!q.rows[0]) return res.status(400).json({ok:false,error:'درخواست نیازِ متناظر معتبر نیست.'});
    targetRequest=q.rows[0];
    if(targetRequest.service_type_id!==sourceRequest.service_type_id) return res.status(400).json({ok:false,error:'خدمت دو درخواست یکسان نیست.'});
    const srcEnd=sourceRequest.date_end||sourceRequest.date_start;
    const tgtEnd=targetRequest.date_end||targetRequest.date_start;
    if(targetRequest.date_start < sourceRequest.date_start || tgtEnd > srcEnd) return res.status(409).json({ok:false,error:'تاریخ درخواست نیاز با بازه ارائه خدمت همخوانی ندارد.'});
  }else if(String(targetRequest.id)!==String(b.targetRequestId||targetRequest.id)){
    return res.status(400).json({ok:false,error:'شناسه درخواست هدف معتبر نیست.'});
  }

  const listing=b.listingId ? (await client.query(`select l.*,s.slug service_slug from service_listings l join service_types s on s.id=l.service_type_id where l.id=$1 and l.provider_id=$2 and l.status='active'`,[b.listingId,proposerId])).rows[0] : null;
  if(b.listingId && !listing)return res.status(400).json({ok:false,error:'خدمت انتخاب‌شده معتبر نیست.'});
  if(sourceRequest.request_kind==='need' && listing){
    const reqEnd=targetRequest.date_end||targetRequest.date_start;
    const ls=listing.availability_start, le=listing.availability_end||listing.availability_start;
    if(ls && ls>targetRequest.date_start) return res.status(409).json({ok:false,error:'بازه زمانی این خدمت با درخواست همخوانی ندارد.'});
    if(le && le<reqEnd) return res.status(409).json({ok:false,error:'بازه زمانی این خدمت با درخواست همخوانی ندارد.'});
    const busy=await client.query(`select 1 from bookings b where b.provider_id=$1 and b.status in ('confirmed','in_progress') and daterange(b.start_date,b.end_date,'[]') && daterange($2,coalesce($3,$2),'[]') and ($4::uuid is null or b.machine_id=$4) limit 1`,[proposerId,targetRequest.date_start,targetRequest.date_end,listing.machine_id||null]);
    if(busy.rowCount) return res.status(409).json({ok:false,error:'این ماشین در این زمان دیگر در دسترس نیست.'});
    if(!activityAreaMatchesLocation(listing.activity_area, targetRequest.service_location_label)) return res.status(409).json({ok:false,error:'محدوده فعالیت این ارائه‌دهنده با محل درخواست همخوانی ندارد.'});
  }
  if(sourceRequest.request_kind==='provide'){
    const busy=await client.query(`select 1 from bookings b where b.provider_id=$1 and b.status in ('confirmed','in_progress') and daterange(b.start_date,b.end_date,'[]') && daterange($2,coalesce($3,$2),'[]') limit 1`,[proposerId,targetRequest.date_start,targetRequest.date_end]);
    if(busy.rowCount) return res.status(409).json({ok:false,error:'این ارائه‌دهنده در این زمان دیگر در دسترس نیست.'});
    if(!activityAreaMatchesLocation(sourceRequest.data?.activityArea, targetRequest.service_location_label)) return res.status(409).json({ok:false,error:'محدوده فعالیت این ارائه‌دهنده با محل درخواست همخوانی ندارد.'});
  }

  // For a need request, a non-owner proposer must have an active provide
  // request/listing for the same service. For a provide anchor, ownership
  // above already proves that the proposer is the provider.
  if(!listing && sourceRequest.request_kind==='need'){
    const ownProvide=await client.query(`select id from requests where requester_id=$1 and request_kind='provide' and status not in ('cancelled','completed','expired') and service_type_id=$2 limit 1`,[proposerId,targetRequest.service_type_id]);
    if(!ownProvide.rowCount)return res.status(403).json({ok:false,error:'برای ارسال پیشنهاد، خدمت ارائه‌شده معتبر پیدا نشد.'});
  }

  const existing=await client.query(`select id from request_recipients where request_id=$1 and proposer_id=$2 and recipient_id=$3 and status in ('pending','accepted')`,[targetRequest.id,proposerId,recipientId]);
  if(existing.rowCount)return res.status(409).json({ok:false,error:'این پیشنهاد قبلاً ارسال شده است.'});
  const reciprocal=await client.query(`select id from request_recipients where request_id=$1 and status in ('pending','accepted') and ((proposer_id=$2 and recipient_id=$3) or (proposer_id=$3 and recipient_id=$2)) limit 1`,[targetRequest.id,proposerId,recipientId]);
  if(reciprocal.rowCount)return res.status(409).json({ok:false,error:'در این درخواست، بین شما و این کاربر یک پیشنهاد فعال وجود دارد.'});

  let unitPrice=listing?Number(listing.price):asNumber(b.unitPrice);
  let priceUnit=listing?listing.price_unit:(b.priceUnit||'');
  if(sourceRequest.request_kind==='provide'){
    unitPrice=asNumber(sourceRequest.data?.price)||unitPrice;
    priceUnit=String(sourceRequest.data?.priceUnit||priceUnit||'');
  }
  const reqData=targetRequest.data||{};
  let total=unitPrice;
  if(String(priceUnit).includes('هکتار')) total=unitPrice*(Number(targetRequest.area_ha)||Number(reqData.area)||0);
  else if(String(priceUnit).includes('تن')) total=unitPrice*(Number(reqData.amount)||Number(reqData.area)||0);
  else if(String(priceUnit).includes('روز')){
    const _s=reqData.dateStart||reqData.date||targetRequest.date_start;
    const _e=reqData.dateEnd||reqData.dateStart||reqData.date||targetRequest.date_end;
    if(_s&&_e){const _sd=new Date(_s),_ed=new Date(_e);if(!isNaN(_sd)&&!isNaN(_ed)) total=unitPrice*Math.max(Math.floor((_ed.getTime()-_sd.getTime())/(24*60*60*1000))+1,1);}
  }else if(String(priceUnit).includes('سرویس')) total=unitPrice;

  await client.query(`insert into request_recipients(request_id,anchor_request_id,proposer_id,recipient_id,provider_id,machine_id,listing_id,unit_price,price_unit,total,rating,location_label,status) values($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,'pending')`,[targetRequest.id,anchorRequestId,proposerId,recipientId,b.machineId||listing?.machine_id||null,b.listingId||null,unitPrice,priceUnit,total,listing?.rating||null,listing?.location_label||b.location||targetRequest.service_location_label||null]);
  await client.query(`update requests set status='pending' where id=$1`,[targetRequest.id]);
  if(anchorRequestId) await client.query(`update requests set status='pending' where id=$1`,[anchorRequestId]);
  res.status(201).json({ok:true,data:await getSnapshot(req.session.userId)});
}catch(e){next(e)}finally{client.release()}});

router.delete('/request-recipients/:id', auth, async(req,res,next)=>{
  try{
    const r = await pool.query(
      "update request_recipients set status='closed', closed_at=now(), responded_at=now() where id=$1 and proposer_id=$2 and status='pending' returning id",
      [req.params.id, req.session.userId]
    );
    if(!r.rowCount) return res.status(404).json({ok:false,error:'این پیشنهاد قابل لغو نیست.'});
    res.json({ok:true, data:await getSnapshot(req.session.userId)});
  } catch(e){ next(e); }
});
router.post('/request-recipients/:id/reject',auth,async(req,res,next)=>{try{const r=await pool.query(`update request_recipients set status='rejected',responded_at=now() where id=$1 and provider_id=$2 and status='pending' returning id`,[req.params.id,req.session.userId]);if(!r.rowCount)return res.status(404).json({ok:false,error:'این پیشنهاد دیگر قابل رد نیست.'});res.json({ok:true,data:await getSnapshot(req.session.userId)})}catch(e){next(e)}});

router.post('/request-recipients/:id/accept',auth,async(req,res,next)=>{try{const r=await pool.query('select * from accept_request_recipient($1,$2)',[req.params.id,req.session.userId]);const snap=await getSnapshot(req.session.userId);res.json({ok:true,bookingId:r.rows[0].booking_id,dealId:r.rows[0].deal_id,data:snap})}catch(e){const map={recipient_not_found:404,request_not_found:404,not_allowed:403,recipient_not_pending:409,request_not_open:409,request_already_agreed:409,machine_unavailable:409,provider_has_unfinished_deal:409};const status=map[e.message]||500;res.status(status).json({ok:false,error:e.message==='provider_has_unfinished_deal'?'برای پذیرش خدمت جدید ابتدا اتمام کار قبلی را ثبت کنید.':e.message})}});

// Cash payment: only the customer (requester) of the deal can mark it paid.
// Persisted on the server so BOTH parties see the "paid" chip and it survives
// a page refresh (before this, payment only lived in the browser's memory).
router.post('/deals/:id/pay',auth,async(req,res,next)=>{
  const client=await pool.connect();
  try{
    await client.query('begin');
    const d=(await client.query(`select * from deals where id=$1 and requester_id=$2 for update`,[req.params.id,req.session.userId])).rows[0];
    if(!d){await client.query('rollback');return res.status(404).json({ok:false,error:'توافق پیدا نشد.'});}
    if(d.status==='cancelled'){await client.query('rollback');return res.status(409).json({ok:false,error:'توافق لغو شده قابل پرداخت نیست.'});}
    if(d.payment_status==='paid'){await client.query('rollback');return res.status(409).json({ok:false,error:'این توافق قبلاً پرداخت شده است.'});}
    await client.query(`update deals set payment_status='paid', status=(case when status='agreed' then 'paid' else status end) where id=$1`,[d.id]);
    const amount=Number(d.total)||0;
    if(amount>0){await client.query(`insert into payments(deal_id,payer_id,amount,gateway,status,paid_at,metadata) values($1,$2,$3,'cash','paid',now(),$4::jsonb)`,[d.id,req.session.userId,amount,JSON.stringify({method:'cash'})]);}
    await client.query('commit');
    res.json({ok:true,data:await getSnapshot(req.session.userId)});
  }catch(e){try{await client.query('rollback')}catch(_){}next(e)}finally{client.release()}
});

router.post('/deals/:id/cancel',auth,async(req,res,next)=>{const client=await pool.connect();try{await client.query('begin');const d=(await client.query(`select * from deals where id=$1 and (requester_id=$2 or provider_id=$2) for update`,[req.params.id,req.session.userId])).rows[0];if(!d){await client.query('rollback');return res.status(404).json({ok:false,error:'توافق پیدا نشد.'});}if(d.status==='completed'||d.status==='cancelled'){await client.query('rollback');return res.status(409).json({ok:false,error:'این توافق در وضعیتی نیست که بتوان آن را لغو کرد.'});}if(d.payment_status==='paid'){await client.query('rollback');return res.status(409).json({ok:false,error:'توافقی که پرداخت شده قابل لغو نیست.'});}await client.query(`update deals set status='cancelled',cancelled_at=now() where id=$1`,[d.id]);await client.query(`update bookings set status='cancelled' where id=$1`,[d.booking_id]);await client.query(`update requests set status='pending' where id=$1 and status<>'completed'`,[d.request_id]);
  // Lifecycle decision: on cancel, THIS recipient row stays 'closed' (not
  // reopened) — that provider must send a brand-new proposal to be
  // considered again on this request.
  await client.query(`update request_recipients set status='closed',closed_at=now() where request_id=$1 and status='accepted'`,[d.request_id]);
  // Mirrors the same rule already used in Local mode (js/app.js cancelDeal):
  // any OTHER candidate on this request that was auto-closed only because
  // this deal got accepted (status='closed' and responded_at is still null —
  // i.e. they never explicitly rejected or withdrew) becomes 'pending' again,
  // so the farmer immediately has other options instead of needing everyone
  // to resend from scratch. A candidate who was explicitly rejected, or who
  // withdrew their own proposal, has responded_at/closed_at set already and
  // is correctly left alone.
  await client.query(`update request_recipients set status='pending',closed_at=null where request_id=$1 and status='closed' and responded_at is null`,[d.request_id]);
  await client.query('commit');res.json({ok:true,data:await getSnapshot(req.session.userId)})}catch(e){try{await client.query('rollback')}catch(_){}next(e)}finally{client.release()}});

router.post('/deals/:id/complete',auth,async(req,res,next)=>{const client=await pool.connect();try{await client.query('begin');const d=(await client.query(`select * from deals where id=$1 and provider_id=$2 for update`,[req.params.id,req.session.userId])).rows[0];if(!d){await client.query('rollback');return res.status(404).json({ok:false,error:'توافق پیدا نشد.'});}if(d.status==='completed'||d.status==='cancelled'){await client.query('rollback');return res.status(409).json({ok:false,error:'این توافق در وضعیتی نیست که بتوان آن را تکمیل کرد.'});}await client.query(`update deals set status='completed',completed_at=now() where id=$1`,[d.id]);await client.query(`update bookings set status='completed' where id=$1`,[d.booking_id]);await client.query(`update requests set status='completed' where id=$1`,[d.request_id]);await client.query(`update request_recipients set status='completed' where request_id=$1 and status='accepted'`,[d.request_id]);await client.query('commit');res.json({ok:true,data:await getSnapshot(req.session.userId)})}catch(e){try{await client.query('rollback')}catch(_){}next(e)}finally{client.release()}});

module.exports = router;
