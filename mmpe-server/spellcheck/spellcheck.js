const spellChecker = require('simple-spellchecker');

let dictionaries = {};


/*
    Accessible from other modules via require-statement
 */

// Expects an array of words.
// Returns a dictionary { misspelledIndex.toString() -> data }, where data again is a dictionary containing spelling suggestions if the word is misspelled.
//e.g. a call with (['hello', 'helo'], "en-GB") gives { '1': [ 'helot', 'help', 'helm', 'hello', 'hell' ] }
module.exports.checkSpellingWithSuggestions = function(words, languageCode, numSuggestions = 5, editDist = 2) {
    const informationDict = {};

    for (let i = 0; i < words.length; i++) {
        if (!checkSpellingSingle(words[i], languageCode)) {
            const key = i.toString();
            informationDict[key] = getSuggestions(words[i], languageCode, numSuggestions, editDist);
        }
    }

    return informationDict;
};

// Expects an array of words.
// Returns an array containing the indices of misspelled words.
module.exports.checkSpelling = function(words, languageCode) {
    const indices = [];

    for (let i = 0; i < words.length; i++) {
        if (!checkSpellingSingle(words[i], languageCode)) {
            indices.push(i);
        }
    }

    return indices;
};


/*
    Not accessible outside this file
 */

// Returns true if the given word is spelled correctly in the given language.
function checkSpellingSingle(word, languageCode) {
    return getDictionary(languageCode).spellCheck(word);
}

// Returns suggestions for the given word in the given language. There will be at maximum <numSuggestions> with a maximal edit distance of <editDist>.
function getSuggestions(word, languageCode, numSuggestions = 5, editDist = 2) {
    return getDictionary(languageCode).getSuggestions(word, numSuggestions, editDist);
}

// Checks if a dictionary already exists for the given language code. If so, it is simply returned. If not, a new dictionary is created.
// For the different language codes please refer to './node_modules/simple-spellchecker/dict'.
function getDictionary(languageCode) {

    //no languageCode given
    if (languageCode == null) {
        console.log('Could not load language. Please provide a language code (e.g. "en-GB", "de-DE"');
        return null;
    }

    // Does the dictionary already exists? -> return or create a new one otherwise
    if (!(languageCode in dictionaries))
        dictionaries[languageCode] = spellChecker.getDictionarySync(languageCode);

    return dictionaries[languageCode];
}
