const router = require('express').Router();
const fs = require("fs");

const jsonPath = './capitalization/jsonFiles/';

router.route('/capitalization/getNouns_de-DE').get(
    function(req, res) {
        const filePath = jsonPath+'nouns_de-DE.json';
        fs.readFile(filePath, function (err, data) {
            if (err) {
                console.log(err)
            }
            const nouns = JSON.parse(data);
            res.json(nouns);
        });
    }
);

module.exports = router;
