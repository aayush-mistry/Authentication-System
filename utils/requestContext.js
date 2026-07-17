const crypto = require('crypto');

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
};

const parseBrowser = (userAgent = '') => {
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/opr\//i.test(userAgent)) return 'Opera';
  if (/chrome|crios/i.test(userAgent)) return 'Chrome';
  if (/firefox|fxios/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome|crios/i.test(userAgent)) return 'Safari';
  if (/msie|trident/i.test(userAgent)) return 'Internet Explorer';
  return 'Unknown Browser';
};

const parseOperatingSystem = (userAgent = '') => {
  if (/windows nt 10/i.test(userAgent)) return 'Windows 10/11';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
  if (/mac os x/i.test(userAgent)) return 'macOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return 'Unknown OS';
};

const parseDeviceType = (userAgent = '') => {
  if (/ipad|tablet/i.test(userAgent)) return 'Tablet';
  if (/mobile|iphone|android/i.test(userAgent)) return 'Mobile';
  return 'Desktop';
};

const getApproximateLocation = (req) => {
  return {
    country: req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || 'Unknown',
    state: req.headers['x-vercel-ip-country-region'] || req.headers['x-region'] || 'Unknown',
    city: req.headers['x-vercel-ip-city'] || req.headers['x-city'] || 'Unknown',
    latitude: Number(req.headers['x-vercel-ip-latitude']) || null,
    longitude: Number(req.headers['x-vercel-ip-longitude']) || null
  };
};

const buildRequestContext = (req) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ipAddress = getClientIp(req);
  const browser = parseBrowser(userAgent);
  const operatingSystem = parseOperatingSystem(userAgent);
  const deviceType = parseDeviceType(userAgent);
  const platform = req.headers['sec-ch-ua-platform'] || operatingSystem;
  const location = getApproximateLocation(req);
  const fingerprintSource = [
    browser,
    operatingSystem,
    deviceType,
    platform,
    userAgent
  ].join('|');

  return {
    browser,
    operatingSystem,
    deviceType,
    userAgent,
    ipAddress,
    location,
    platform,
    fingerprint: crypto.createHash('sha256').update(fingerprintSource).digest('hex')
  };
};

module.exports = {
  buildRequestContext
};
