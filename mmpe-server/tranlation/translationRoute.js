const router = require('express').Router();
const axios = require('axios');
const { RSA_NO_PADDING } = require('constants');

const config = require("../config.json");

//send post request for hypotheses
router.route('/alternatives').post(
    function(req, res) {
        // this can potentially point to another server;
        // so make this URL configurable via config file and environment variable
        axios.post(process.env.IPE_URL || config.ipeUrl, {
            ...req.body
        }, {
            'content-type': 'application/json',
        }).then(result => {
            console.log("resukt data in server", result.data);
            res.json(result.data);
        }).catch(error => {
            console.log("failed request111");
            res.json({error: "error"});
        });
    }
);

module.exports = router