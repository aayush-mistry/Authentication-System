const { startOAuth, handleOAuthCallback } = require('./oauthBaseController');

module.exports = {
  startFacebookAuth: startOAuth('facebook'),
  handleFacebookCallback: handleOAuthCallback('facebook')
};
