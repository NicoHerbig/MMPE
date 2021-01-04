const router = require('express').Router();
const dictionary = require('./lingueeDict');    // update this to use another underlying dictionary in the future

router.route('/dictionary').get(
    function(req, res) {
        const word = req.query.word;
        const from = req.query.from;
        const to = req.query.to;

        console.log('>> RECEIVED GET AT /dictionary: word = ' + word + ', from = ' + from + ', to = ' + to);

        try {
            dictionary.translate(word, from, to)
                .then(
                    translation => {
                        res.send(translation);
                    })
                .catch(reject => {
                    console.log('rejected: Could not translate ' + word + ' from ' + from + ' to ' + to);
                    console.log(reject);
                    res.status(400).send('Could not translate ' + word + ' from ' + from + ' to ' + to);
                    });
            // console.log('<< SENDING DUMMY DATA');
            // res.send(dictionary.getDummyData());
        } catch (e) {
            res.status(400).send('Could not translate ' + word + ' from ' + from + ' to ' + to);
        }
    }
);

module.exports = router;
