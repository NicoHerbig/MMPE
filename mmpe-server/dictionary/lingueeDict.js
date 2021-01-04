const linguee = require('linguee');

module.exports.translate = function(word, from, to) {
    return new Promise(

        function(resolve, reject) {
            linguee
                .translate(word, {from: from, to: to})
                .then(response => {
                    return resolve(response);
                }).catch( err => reject(err));
            }
        );
};

module.exports.getDummyData = function () {
    return {
    "query": "aufräumen",
    "words": [
      {
        "term": "aufräumen",
        "audio": "https://www.linguee.com/mp3/DE/69/6905fffa7d44b19da53df5cf124c4515-200",
        "additionalInfo": "(etw.Akk ~)",
        "type": "verb",
        "translations": [
          {
            "term": "clean sth. up",
            "audio": null,
            "type": "verb",
            "alternatives": [],
            "examples": [
              {
                "from": "Dieses Wochenende muss ich mein Zimmer aufräumen. ",
                "to": "This weekend I have to clean up my room."
              }
            ]
          },
          {
            "term": "clear",
            "audio": "https://www.linguee.com/mp3/EN_US/01/01bc6f8efa4202821e95f4fdf6298b30-200",
            "type": "verb",
            "alternatives": [
              {
                "term": "cleared",
                "type": null
              },
              {
                "term": "cleared",
                "type": null
              }
            ],
            "examples": [
              {
                "from": "Ich räumte das Zimmer auf, um mehr Platz zu schaffen.",
                "to": "I cleared the room to make more space."
              }
            ]
          },
          {
            "term": "clear up",
            "audio": "https://www.linguee.com/mp3/EN_US/80/80edc311f2d4742023e99a3db0e02917-200",
            "type": "verb",
            "alternatives": [],
            "examples": [
              {
                "from": "Nach der Party mussten wir das Haus aufräumen.",
                "to": "We had to clear up the house after the party."
              }
            ]
          },
          {
            "term": "tidy sth.",
            "audio": "https://www.linguee.com/mp3/EN_US/35/3513bf8fe595c018be09f5fd048ca814-200",
            "type": "verb",
            "alternatives": [
              {
                "term": "tidied",
                "type": null
              },
              {
                "term": "tidied",
                "type": null
              }
            ],
            "examples": [
              {
                "from": "Ich räume das Haus auf, bevor Gäste kommen. ",
                "to": "I tidy the house before visitors come over. "
              }
            ]
          },
          {
            "term": "tidy up",
            "audio": "https://www.linguee.com/mp3/EN_US/40/40eef5b64045b5da20c4149ddfba8482-200",
            "type": "verb",
            "alternatives": [],
            "examples": [
              {
                "from": "Ich werde aufräumen und diesen ganzen Müll wegwerfen.",
                "to": "I will tidy up and throw away all this junk."
              }
            ]
          }
        ],
        "lessCommonTranslations": [
          {
            "term": "declutter",
            "type": "verb",
            "usage": null
          },
          {
            "term": "put away",
            "type": "verb",
            "usage": null
          },
          {
            "term": "straighten up",
            "type": "verb",
            "usage": null
          }
        ]
      },
      {
        "term": "Aufräumen",
        "audio": null,
        "additionalInfo": null,
        "type": "noun, neuter",
        "translations": [
          {
            "term": "cleaning up",
            "audio": "https://www.linguee.com/mp3/EN_US/c6/c6a79f2141304204f3714c28d02da0ac-101",
            "type": "noun",
            "alternatives": [],
            "examples": []
          }
        ],
        "lessCommonTranslations": []
      }
    ],
    "examples": [
      {
        "from": {
          "content": "sein Zimmer aufräumen",
          "type": "verb",
          "audio": null
        },
        "to": [
          {
            "content": "tidy one's room",
            "type": "verb"
          }
        ]
      },
      {
        "from": {
          "content": "ein Durcheinander aufräumen",
          "type": "verb",
          "audio": null
        },
        "to": [
          {
            "content": "clear up a mess",
            "type": "verb"
          }
        ]
      },
      {
        "from": {
          "content": "mit etw.Dat aufräumen",
          "type": "verb",
          "audio": null
        },
        "to": [
          {
            "content": "do away with sth.",
            "type": "verb"
          },
          {
            "content": "get rid of sth.",
            "type": "verb"
          }
        ]
      }
    ]
  };
};
