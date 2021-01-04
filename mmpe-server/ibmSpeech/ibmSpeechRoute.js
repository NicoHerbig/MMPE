const router = require('express').Router();
const speech = require('./ibmSpeech');
const fs = require("fs");

const jsonPath = './ibmSpeech/jsonFiles/';

router.route('/ibmSpeech/getTranscript').post(
    function (req, res) {
        try {
            speech.app(req.body);
        } catch (e) {
            console.log('Could not connect :');
            console.log(e);
        }
    }
);

router.route('/ibmSpeech/getCommandsJSON').get(
    function(req, res) {
        const filePath = jsonPath+'commands.json';
        fs.readFile(filePath, function (err, data) {
            if (err) {
                console.log(err)
            }
            const commands = JSON.parse(data);
            res.json(commands);
        });
    }
);

router.route('/ibmSpeech/getSynonymsJSON_de-DE').get(
    function(req, res) {
        const filePath = jsonPath+'synonyms_de-DE.json';
        fs.readFile(filePath, function (err, data) {
            if (err) {
                console.log(err)
            }
            const commands = JSON.parse(data);
            res.json(commands);
        });
    }
);


module.exports = router;
