const { startOAuth, handleOAuthCallback } = require('./oauthBaseController');

module.exports = {
  startGoogleAuth: startOAuth('google'),
  handleGoogleCallback: handleOAuthCallback('google')
};
