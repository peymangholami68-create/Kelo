/**
 * KELO Domain — Live location sharing rules
 */
(function (global) {
  'use strict';

  var LOCATION_SHARING_STATUSES = {
    agreed: true,
    paid: true,
    in_progress: true,
    accepted: true // some flows keep accepted until paid
  };

  function isLocationSharingActive(deal) {
    if (!deal) return false;
    var s = String(deal.status || '');
    if (s === 'completed' || s === 'cancelled') return false;
    if (LOCATION_SHARING_STATUSES[s]) return true;
    // also allow when payment done but status string varies
    if (String(deal.paymentStatus || deal.payment_status || '') === 'paid' && s !== 'completed' && s !== 'cancelled') {
      return true;
    }
    return false;
  }

  function isProvider(deal, userId) {
    if (!deal || !userId) return false;
    return String(deal.providerId) === String(userId);
  }

  function isRequester(deal, userId) {
    if (!deal || !userId) return false;
    return String(deal.userId || deal.requesterId) === String(userId);
  }

  /** Farmer destination from deal / linked need request */
  function getFarmerDestination(deal, requests) {
    requests = requests || [];
    if (!deal) return null;
    var req = requests.find(function (r) { return String(r.id) === String(deal.requestId); });
    var loc = null;
    if (req && req.data && req.data.serviceLocation && typeof req.data.serviceLocation.lat === 'number') {
      loc = req.data.serviceLocation;
    } else if (deal.requestLocation && typeof deal.requestLocation.lat === 'number') {
      loc = deal.requestLocation;
    } else if (deal.requestData && deal.requestData.serviceLocation && typeof deal.requestData.serviceLocation.lat === 'number') {
      loc = deal.requestData.serviceLocation;
    }
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return null;
    return { lat: loc.lat, lng: loc.lng, label: loc.label || loc.city || 'محل خدمت' };
  }

  global.KeloDomain = global.KeloDomain || {};
  global.KeloDomain.location = {
    isLocationSharingActive: isLocationSharingActive,
    isProvider: isProvider,
    isRequester: isRequester,
    getFarmerDestination: getFarmerDestination,
    LOCATION_SHARING_STATUSES: LOCATION_SHARING_STATUSES
  };
})(typeof window !== 'undefined' ? window : globalThis);
