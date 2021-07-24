const router = require('express').Router();
const axios = require('axios');
const { RSA_NO_PADDING } = require('constants');

//send post request for hypotheses
router.route('/alternatives').post(
    function(req, res) {
        axios.post('http://localhost:8000/api/alternatives', {
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