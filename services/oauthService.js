const User = require('../models/User');

class OAuthError extends Error {
  constructor(message, statusCode = 400, code = 'oauth_error') {
    super(message);
    this.name = 'OAuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const normalizeUsername = (value) => {
  return String(value || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'user';
};

const getUniqueUsername = async (name, email) => {
  const emailPrefix = email ? email.split('@')[0] : '';
  const base = normalizeUsername(name || emailPrefix);
  let candidate = base;
  let suffix = 1;

  while (await User.findByUsername(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const requestJson = async (url, options = {}) => {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new OAuthError('Unable to reach the authentication provider. Please try again.', 503, 'provider_unavailable');
  }

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    throw new OAuthError('The authentication provider returned an invalid response.', 502, 'invalid_provider_response');
  }

  if (!response.ok) {
    const detail = data.error_description || data.error?.message || data.error || 'Authentication failed';
    throw new OAuthError(detail, response.status, 'authentication_failed');
  }

  return data;
};

const exchangeCodeForToken = async (provider, code) => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: provider.redirectUri,
    client_id: provider.clientId,
    client_secret: provider.clientSecret
  });

  return requestJson(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body
  });
};

const fetchProviderProfile = async (provider, accessToken) => {
  return requestJson(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
};

const normalizeProviderProfile = (providerKey, rawProfile) => {
  if (providerKey === 'google') {
    return {
      providerId: rawProfile.sub,
      fullName: rawProfile.name,
      email: rawProfile.email,
      profilePicture: rawProfile.picture,
      emailVerified: Boolean(rawProfile.email_verified)
    };
  }

  if (providerKey === 'facebook') {
    return {
      providerId: rawProfile.id,
      fullName: rawProfile.name,
      email: rawProfile.email,
      profilePicture: rawProfile.picture?.data?.url,
      emailVerified: false
    };
  }

  if (providerKey === 'linkedin') {
    return {
      providerId: rawProfile.sub,
      fullName: rawProfile.name,
      email: rawProfile.email,
      profilePicture: rawProfile.picture,
      emailVerified: Boolean(rawProfile.email_verified)
    };
  }

  throw new OAuthError('Unsupported authentication provider.', 400, 'unsupported_provider');
};

const authenticateOAuthUser = async ({ providerKey, provider, code }) => {
  if (!provider.clientId || !provider.clientSecret) {
    throw new OAuthError(`${provider.name} login is not configured yet.`, 503, 'provider_not_configured');
  }

  const tokenResponse = await exchangeCodeForToken(provider, code);
  if (!tokenResponse.access_token) {
    throw new OAuthError('The authentication provider did not return an access token.', 502, 'missing_access_token');
  }

  const rawProfile = await fetchProviderProfile(provider, tokenResponse.access_token);
  const profile = normalizeProviderProfile(providerKey, rawProfile);

  if (!profile.providerId || !profile.email) {
    throw new OAuthError('Your provider account must include an email address to sign in.', 400, 'missing_profile_email');
  }

  const authenticationProvider = provider.name;
  const existingByProvider = await User.findByProvider(authenticationProvider, profile.providerId);
  if (existingByProvider) return existingByProvider;

  const existingByEmail = await User.findByEmail(profile.email);
  if (existingByEmail) {
    const currentProvider = existingByEmail.authentication_provider || 'Local';
    if (currentProvider !== 'Local' && currentProvider !== authenticationProvider) {
      throw new OAuthError(
        `This email is already linked with ${currentProvider}. Please sign in with ${currentProvider}.`,
        409,
        'email_linked_with_another_provider'
      );
    }

    return User.linkOAuthProvider(existingByEmail.id, {
      authenticationProvider,
      providerId: profile.providerId,
      profilePicture: profile.profilePicture,
      emailVerified: profile.emailVerified
    });
  }

  const username = await getUniqueUsername(profile.fullName, profile.email);
  return User.createOAuthUser({
    username,
    email: profile.email,
    authenticationProvider,
    providerId: profile.providerId,
    profilePicture: profile.profilePicture,
    emailVerified: profile.emailVerified
  });
};

module.exports = {
  OAuthError,
  authenticateOAuthUser
};
