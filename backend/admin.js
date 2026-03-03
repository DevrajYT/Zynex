// This middleware must run AFTER verifyFirebaseToken
const checkAdmin = (req, res, next) => {
  // The 'admin' property is a custom claim set on the user's Firebase account.
  if (req.user && req.user.admin === true) {
    return next();
  }

  return res.status(403).send('Forbidden: Requires admin access.');
};

module.exports = checkAdmin;