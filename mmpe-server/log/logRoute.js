const router = require('express').Router();
const log = require('./log');

router.route('/log/lowlevel').post(
    function (req, res) {

        console.log('>> RECEIVED POST AT /log/lowlevel: ' + req.body['type']);

        try {
            log.logLowlevelEvents(req.body);
        } catch (e) {
            console.log('Could not log lowlevel event:');
            console.log(e);
        } finally {
            res.end();
        }
    }
);

router.route('/log/highlevel').post(


    function (req, res) {

        console.log('>> RECEIVED POST AT /log/highlevel: ' + req.body['type']);

        try {
            log.logHighlevelEvents(req.body);
        } catch (e) {
            console.log('Could not log highlevel event:');
            console.log(e);
        } finally {
            res.end();
        }
    }
);

module.exports = router;
