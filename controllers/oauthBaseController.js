const providers = require('../config/oauthProviders');
const { createOAuthState, verifyOAuthState, STATE_MAX_AGE_MS } = require('../utils/oauthState');
const { authenticateOAuthUser, OAuthError } = require('../services/oauthService');
const { generateTokenAndSetCookie } = require('./authController');

const stateCookieName = (providerKey) => `oauth_state_${providerKey}`;

const getProvider = (providerKey) => {
  const provider = providers[providerKey];
  if (!provider) {
    throw new OAuthError('Unsupported authentication provider.', 400, 'unsupported_provider');
  }
  return provider;
};

const redirectToLoginWithError = (res, message) => {
  res.redirect(`/login.html?oauth_error=${encodeURIComponent(message)}`);
};

const startOAuth = (providerKey) => (req, res) => {
  try {
    const provider = getProvider(providerKey);
    if (!provider.clientId || !provider.clientSecret) {
      return redirectToLoginWithError(res, `${provider.name} login is not configured yet.`);
    }

    const state = createOAuthState();
    res.cookie(stateCookieName(providerKey), state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: STATE_MAX_AGE_MS
    });

    const authorizationUrl = new URL(provider.authorizationUrl);
    authorizationUrl.searchParams.set('client_id', provider.clientId);
    authorizationUrl.searchParams.set('redirect_uri', provider.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', provider.scope);
    authorizationUrl.searchParams.set('state', state);

    res.redirect(authorizationUrl.toString());
  } catch (error) {
    console.error(error);
    redirectToLoginWithError(res, 'Unable to start social login. Please try again.');
  }
};

const handleOAuthCallback = (providerKey) => async (req, res) => {
  const provider = getProvider(providerKey);
  const cookieName = stateCookieName(providerKey);

  try {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
      const message = error === 'access_denied'
        ? `${provider.name} sign-in was cancelled.`
        : errorDescription || `${provider.name} authentication failed.`;
      return redirectToLoginWithError(res, message);
    }

    if (!verifyOAuthState(state, req.cookies[cookieName])) {
      return redirectToLoginWithError(res, 'Your sign-in session expired. Please try again.');
    }

    if (!code) {
      return redirectToLoginWithError(res, `${provider.name} did not return an authorization code.`);
    }

    const user = await authenticateOAuthUser({ providerKey, provider, code });
    generateTokenAndSetCookie(res, user.id, user.token_version);

    res.clearCookie(cookieName);
    res.redirect('/index.html?auth=oauth_success');
  } catch (error) {
    console.error(error);
    const message = error instanceof OAuthError
      ? error.message
      : 'Social login failed unexpectedly. Please try again.';
    redirectToLoginWithError(res, message);
  }
};

module.exports = {
  startOAuth,
  handleOAuthCallback
};
