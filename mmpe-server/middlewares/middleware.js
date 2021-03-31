var http = require('http');
const router = require('express').Router();
const AUTHORIZED_ACCESS = 'referer';
const config = require("../config.json");
const bcrypt = require('bcrypt');

function requireLogin(req, res, next) {
        try{
        if(req.headers[AUTHORIZED_ACCESS] !== undefined){
            next();
        }
        else{
            return res.status(401).json({
                'message':"Unauthorized access"
            })    
        }
       }
        catch(e){
        return res.status(401).json({
            'message':"Invalid or expired token",
            'error':e
        })
      }
}

router.route('/middleware/validate').post(
    function(req, res) {
        const password = bcrypt.hashSync(config.loginCredentials.passwords[config.loginCredentials.email_IDs.indexOf(req.body.email)], req.body.salt);
        if (config.loginCredentials.email_IDs.includes(req.body.email) &&
        req.body.password === password){
           const projectIndex = config.loginCredentials.email_IDs.indexOf(req.body.email);
           const projectIds = config.projectIDs.projects[projectIndex];
            res.json({ authenticate: projectIds });

    }
    else { 
            res.json({ authenticate: false });
    }
  }
);
    

module.exports = {
    router: router,
    requireLogin: requireLogin
}