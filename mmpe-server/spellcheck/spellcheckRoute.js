const router = require('express').Router();
const spellchecker = require('./spellcheck');

// Can be used to check the spelling for a list of words.
// Expects 2-5 parameters in the body:
//      - words (list of words that should be checked)
//      - languageCode (indicates the language of the given words)
//      [- suggestions (boolean indicating whether spelling suggestions should be provided or not)]
//      [- numSuggestions (number of suggestions that should be determined, works only if suggestions = true]
//      [- editDist (maximal edit distance of suggestions, works only if suggestions = true]
router.route('/spelling').post(
    function(req, res) {

        const words = req.body["words"];
        const languageCode = req.body["languageCode"];

        const numSuggestions = req.body["numSuggestions"];
        const editDist = req.body["editDist"];

        let suggestions = req.body["suggestions"];

        // words not correctly given or no language specified -> NotAcceptable
        if (words == null || !Array.isArray(words) || languageCode == null) {
            req.status(406).send('Invalid words or language code.');
        }

        // suggestions not given -> use false as default
        if (suggestions == null) {
            suggestions = false;
        }

        // compute requested data
        try {

            let spellcheck;

            if (suggestions) {

                if (editDist != null && numSuggestions != null)
                    spellcheck = spellchecker.checkSpellingWithSuggestions(words, languageCode, numSuggestions, editDist);
                else if (editDist != null)
                    spellcheck = spellchecker.checkSpellingWithSuggestions(words, languageCode, editDist);
                else if (numSuggestions != null)
                    spellcheck = spellchecker.checkSpellingWithSuggestions(words, languageCode, numSuggestions);
                else
                    spellcheck = spellchecker.checkSpellingWithSuggestions(words, languageCode);

            } else {
                spellcheck = spellchecker.checkSpelling(words, languageCode);
            }

            const response = {misspellings: spellcheck};

            res.json(response);
        } catch {
            //Something went wrong. This is probably due to a wrong parameter. -> NotAcceptable
            res.status(406).send('Could not process the given parameters.');
        }
    }
);


module.exports = router;
