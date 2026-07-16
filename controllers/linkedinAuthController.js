const { startOAuth, handleOAuthCallback } = require('./oauthBaseController');

module.exports = {
  startLinkedInAuth: startOAuth('linkedin'),
  handleLinkedInCallback: handleOAuthCallback('linkedin')
};
