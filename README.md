![MMPE-Logo](/assets/imgs/mmpe-logo.png)

# MMPE
The shift from traditional translation to post-editing (PE) of machine-translated (MT) text can save time and reduce errors, but it also affects the design of translation interfaces, as the task changes from mainly generating text to correcting errors within otherwise helpful translation proposals. Since this paradigm shift offers potential for modalities other than mouse and keyboard, we present MMPE, the first prototype to combine traditional input modes with pen, touch, and speech modalities for PE of MT. Users can directly cross out or hand-write new text, drag and drop words for reordering, or use spoken commands to update the text in place. All text manipulations are logged in an easily interpretable format to simplify subsequent translation process research.

This project was funded in part by the German Research Foundation (DFG) under grant number GE2819/2-1 (project MMPE).

## Table of content

- [Repository overview](#repository-overview)
- [Requirements](#requirements)
- [Configuration](#configuration)
- [Running the repository](#running-the-repository)
- [Server deployment](#deployment)
- [Create translation projects](#create-translation-projects)
- [Contact](#contact)
- [Troubleshooting during installation](#troubleshooting)
- [Hardware](#hardware)
- [Template](#template)
- [Further reading & Citation](#further-reading)
- [Notes regarding logging](#logging)
- [Notes regarding touch and pen functionality](#touch-and-pen)
- [Notes regarding eye tracking functionality](#eye-tracking)
- [Notes regarding speech and multi-modal functionality](#speech-and-multi-modal)
- [Notes regarding mid-air gesture functionality](#mid-air-gesture)
- [Notes regarding quality estimation functionality](#quality-estimation)
- [Notes regarding interactive post-editing (IPE) functionality](#ipe)


## Repository overview <a name="repository-overview"></a>
While the project is called front-end, it actually does contain a very simply server as well.
The structure is:
- mmpe-frontend: contains the Angular project which really is the frontend
- mmpe-server: contains a simple node.js server responsible for project load & store, 
as well as microservices like spellchecking
- python-backend: providing interactive post-editing (IPE) functionality, i.e. generating multiple alternatives and clustering these alternatives into different categories. Note that IPE functionality is optional.

## Requirements <a name="requirements"></a>
- node.js
- Angular CLI
- Ensure that git and python are in PATH.
- For IPE only:
    - Create a [Conda](https://conda.io) environment including all required dependencies by running
      ```
      conda env create -f python-backend/environment.yml
      ```
    - IPE requires a translation model not included in this repository. Use the convenient script `./download-ipe-model.sh` to add the model to your local installation. 
    - Note that IPE only runs under Linux.

## Configuration <a name="configuration"></a>
The projects won't really work without configuration. We prepared dummy config files that you can use as a basis:
- copy the file mmpe-frontend/src/assets/config.json.example to mmpe-frontend/src/assets/config.json (copy and remove the .example)
    - for the project to run, you have to at least copy the example file
    - Deactivate features: MMPE has a lot features, from which you might not need or want all. To easily deactivate those, use the variables: "enableSpeech", "enableEyeTracking", "enableWhiteSpace", "enableSpellcheck", "enableHandwriting", "enableMidairGestures", "enableIPE"
    - to use handwriting: get a myScript application and hmac key, insert the credentials, and define the target language
    - to use speech: additionally set the "speechLanguage" and if you have custom IBM Watson model, the "speechModelCustomizationID"

- copy the file mmpe-server/config.json.example to mmpe-server/config.json (copy and remove the .example)
    - if you do not want to use speech input, just copy the config example, but a file is needed for the server to run
    - if you want to use speech, create credentials on the IBM Watson website and insert them here
    - to log in: add emails, passwords, and projects to the corresponding arrays
        - the email and password pairs at the same positions in the array allow you to log in
        - the list of integers at the same position in the projects defines which projects to see. They all start with "project" followed by the specified id.

- to see translation projects, create them in mmpe-server/data/projects. You can use project*.json.example and remove the ".example" part to get a starting point. For more information on projects, check the section here in this Readme.

## Running the repository <a name="running-the-repository"></a>
- go into each mmpe folder separately and run `npm install`
- then run both projects using `npm start` (or a run configuration in your IDE)
- for IPE:
  - activate the IPE Conda environment and start the uvicorn service
    ```
    conda activate ipe
    cd python-backend/ende_ctranslate2-v2
    uvicorn main:app --host 0.0.0.0 --reload
    ```
- open Chrome on localhost:4200 (other browsers most likely work too, but we tested on Chrome)

Careful: while mmpe-frontend automatically rebuilds on changes, mmpe-server does not. If you want that, you can use nodemon or similar tools. Or simply restart after changes.

To deploy the project (instead of running it for development), see the instructions below.

## Server deployment <a name="deployment"></a>
We provide Docker images for easy deployment of MMPE (including IPE). Docker images for both MMPE and IPE are defined in the corresponding Dockerfiles. Before building the images, first configure MMPE as described [above](#configuration) and also download the IPE translation model using `./download-ipe-model.sh`. Then build the Docker images by running `./build-docker-images.sh` in the top level folder of the distribution.

Start MMPE by running `docker-compose up -d`. MMPE and IPE each run in a separate container within a Docker network. Note that MMPE configuration files as well as the projects folder are passed as bind mounts to the mmpe-core Docker container. This is to make sure that any configuration changes are applied when the MMPE containers are restarted. Also, any edits done in the projects are still available after a container restart.

After deployment MMPE can be accessed via `https://<your-server-name>`. Note that we use a self-signed certificate, so click away the browser warning and continue to the MMPE login page.

Note that eye tracking and mid-air gestures are not available with server deployment.

## Create translation projects <a name="create-translation-projects"></a>
Translation projects need to be stored in mmpe-server/data/projects. 
You can use project*.json.example and remove the ".example" part to get a starting point.
  - project1.json is an example project without IPE
  - project2.json is an example project with LMM IPE
  - project3.json is an example project with LCD IPE
  - project4.json is an example project with DeepL IPE

To see the project in the interface, the user you log in with needs to have the project id in the list of projects within mmpe-frontend/src/assets/config.json, as described above.

A translation project is simply a JSON file with the following structure:
```json
{
	"projectid": 1,
	"projectname": "Project1",
	"segments": [{
		"id": 1,
		"source": "Customers who once sold their vinyl to buy CDs are now selling their CDs to buy their records back, he says.",
		"target": "Zu ddie ihre CDs, Aufzeichnungenzurückzukaufen tzt ihre um &quot;, sagt er.",
		"mt": "Kunden, die früher ihre Vinyl verkauften, um CDs zu kaufen, verkaufen jetzt ihre CDs, um ihre Aufzeichnungen zurückzukaufen &quot;, sagt er.",
		"sourceLanguage": "EN-US",
		"targetLanguage": "DE-DE",
		"segmentStatus": 0,
        "visualizationIPE": "mmpe-LMM/mmpe-LCD/mmpe-DeepL"
	    }, 
	    ...
	    ]
}
```

- "projectid" must be unique and is used to access the project in the url. It is also added to every log entry. The filename should also be project<ProjectId>.json
- "projectname" the name that is displayed at the top left when editing
- "segments" is an array of individual segments:
    - "id" is shown on the very left
    - The "source" is what will be displayed on the left
    - The "target" will be displayed on the right and change upon edits in the interface. 
    - "mt" is just there to support reverting to it using a button in the support tools.
    - "sourceLanguage" and "targetLanguage" are currently not used but could be displayed somewhere if required.
    - "segmentStatus" defines the status of the segment which is displayed as an icon between source and target. It can be Confirmed = 0, Unconfirmed = 1, or Active = 2.
    - "visualizationIPE" the user can choose between three visualizations namely:
      (1) mmpe-LMM (2) mmpe-LCD (3) mmpe-DeepL; for no IPE, just omit ""visualizationIPE"

For certain studies, it might make sense to tell the translator what to do or ask after each segment how it was. 
For this, we implemented a popup before/after each segment.
Which popup is being shown is defined in mmpe-frontend/src/app/components/segment-detail/segment-detail.component.ts, in StudyDialog's templateUrl. 
If set to study-dialog.modality.html as in the ACL study, it shows: 

![Popup](/assets/imgs/popup-modality.png)

The data to populate the popup is retrieved from the project file, by adding the following to each segment:
```json
        "studyOperation": "REPLACE",
		"studyTrial": true,
		"studyCorrection": "In die große Übersichtskarte <span class=\"wrong\">wurde</span><span class=\"correct\">wurden</span> für Städte und Gemeinden detailliertere Karten, sogenannte Urpositionsblätter, eingearbeitet.",
		"studyModality": "Pen",
```

This shows the "studyOperation" followed by the "studyModality" in the header, then the "source", "mt", and "correction".
Times between clicking the START button and confirming a segment are logged. "studyTrial" is for logging, so that you can for example exclude the data from the first few segments.

To generate projects with these additional fields, latin square balancing, etc. the mmpe-server/data/projectGenerator/projectGenerator.js can be used.

Note: Projects should NOT BE PUSHED and are therefore under .gitignore. 

## Contact <a name="contact"></a>
This project has only recently been open-sourced. If you feel like the documentation or code could be improved (which I am sure it can), please either get actively involved through issues and merge requests. Or, if you aren't a developer, simply contact me ([Nico Herbig](mailto:nico.herbig@dfki.de)). I'll be happy to help and also thankful for useful feedback. 

## Troubleshooting during installation <a name="troubleshooting"></a>
**1. Downloading binary SASS**

*Error:*

Downloading binary from https://github.com/sass/node-sass/releases/download/v4.11.0/darwin-x64-72_binding.node
Cannot download "https://github.com/sass/node-sass/releases/download/v4.11.0/darwin-x64-72_binding.node": 
 HTTP error 404 Not Found

*Solution:*

If github.com is not accessible in your location try setting a proxy via HTTP_PROXY, e.g. 

a. Download: darwin-x64-72_binding.node from https://github.com/sass/node-sass/releases/

b. export SASS_BINARY_PATH=~PATH/darwin-x64-72_binding.node

c. npm install

-----------------------

**2. TS1086: Aceessor cannot be declared**

*Error:*

TS1086: An accessor cannot be declared in ambient context

*Solution:*

Update the @angular/cli using the command : ng update –next @angular/cli  --force

This updates all the peer dependencies as well. Update (Upgrade/downgrade) packages (Using ng update) to be compatible with the angular cli version. 

-----------------------

**3. Uncaught TypeError: Cannot read property 'prototype'  OR 'superCtor is undefined' at inherits**

*Error:*

Uncaught TypeError: Cannot read property 'prototype' of undefined at inherits (inherits_browser.js:5)

OR

superCtor is undefined (inherits inherits_browser.js)

*Solution:*


modify the line 'var Readable = require('stream').Readable;' in index.js of readable-blob-stream to 'var Readable = require('readable-stream').Readable;'
More about the error is given here: https://stackoverflow.com/questions/60779965/typeerror-superctor-is-undefined-inherits-inherits-browser-js?noredirect=1#comment107536930_60779965
 
## Hardware <a name="hardware"></a>
![Apparatus](/assets/imgs/apparatus.jpeg)

The project is based on web-technolgies, so in principle all you need is a browser. However, depending on the features you want to use, we recommend the following:

- a large tiltable touch and pen screen (we used the Wacom Cintiq Pro 32, but others should also work).
- an external headset. In our experience microphones integrated in laptops often yield bad transcriptions, thereby severely impacting the speech recognition functionality.
- an Eye Tracker. Scripts for the Tobii 4C are available. Support for other eye trackers can be easily added, see below.
- a Leap Motion for mid-air gestures

## Template <a name="template"></a>
The HTML/CSS/JS template used for this project can be found ![here](https://startbootstrap.com/theme/creative)

If you want to add further UI elements, it might make sense to look in the template for nice-looking alternatives.


## Further reading & Citation<a name="further-reading"></a>
Before getting started, we recommend to look at the following papers/blog posts. These will introduce all the features.

- [The original elicitation study, which guided the initial design of the prototype](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_mmpe_acl_full.pdf)
- [The ACL full paper, focusing on an evaluation with the prototype in the demo paper](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_mmpe_acl_full.pdf)
- [A demo paper at ACL, short, focusing on the prototype, but without the latest changes](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_mmpe_acl_demo.pdf)
- [A long version of the prototype focusing on the improvements after a study we ran](https://umtl.cs.uni-saarland.de/paper_preprints/paper_herbig_improving_MMPE.pdf)
- [A blog post on MMPE in Kirti Vashee' "eMpTy Pages"](http://kv-emptypages.blogspot.com/2020/10/the-evolving-translator-computer.html)
- [The ACL paper on mid-air hand gestures for PE MT](https://umtl.cs.uni-saarland.de/paper_preprints/paper_jamara_gesture_pe.pdf)
- [The EMNLP paper on investigating the helpfulness of QE for PE MT](https://umtl.cs.uni-saarland.de/paper_preprints/paper_shenoy_QE_helpfulness.pdf)

These and more publications can also be found on the [MMPE Website](https://mmpe.dfki.de)

If you use this project, please cite the publication containing the aspects you refer to:
```bibtex
@inproceedings{herbig2019multi,
  title={Multi-modal approaches for post-editing machine translation},
  author={Herbig, Nico and Pal, Santanu and van Genabith, Josef and Kr{\"u}ger, Antonio},
  booktitle={Proceedings of the 2019 CHI Conference on Human Factors in Computing Systems},
  pages={1--11},
  year={2019}
}

@inproceedings{herbig-etal-2020-mmpe,
    title = "{MMPE}: {A} {M}ulti-{M}odal {I}nterface for {P}ost-{E}diting {M}achine {T}ranslation",
    author = {Herbig, Nico and D{\"u}wel, Tim and Pal, Santanu and Meladaki, Kalliopi and Monshizadeh, Mahsa and Kr{\"u}ger, Antonio and van Genabith, Josef},
    booktitle = "Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics",
    year = "2020",
    publisher = "Association for Computational Linguistics",
    url = "https://www.aclweb.org/anthology/2020.acl-main.155",
    doi = "10.18653/v1/2020.acl-main.155",
    pages = "1691--1702",
}

@inproceedings{herbig-etal-2020-mmpe-multi,
    title = "{MMPE}: {A} {M}ulti-{M}odal {I}nterface using {H}andwriting, {T}ouch {R}eordering, and {S}peech {C}ommands for {P}ost-{E}diting {M}achine {T}ranslation",
    author = {Herbig, Nico and Pal, Santanu and D{\"u}wel, Tim and Meladaki, Kalliopi and Monshizadeh, Mahsa and Hnatovskiy, Vladislav and Kr{\"u}ger, Antonio and van Genabith, Josef},
    booktitle = "Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics: System Demonstrations",
    year = "2020",
    publisher = "Association for Computational Linguistics",
    url = "https://www.aclweb.org/anthology/2020.acl-demos.37",
    doi = "10.18653/v1/2020.acl-demos.37",
    pages = "327--334",
}

@inproceedings{herbig-etal-2020-improving,
    title = "Improving the Multi-Modal Post-Editing ({MMPE}) {CAT} Environment based on Professional Translators{'} Feedback",
    author = {Herbig, Nico and Pal, Santanu and D{\"u}wel, Tim  and Shenoy, Raksha and Kr{\"u}ger, Antonio and van Genabith, Josef},
    booktitle = "Proceedings of 1st Workshop on Post-Editing in Modern-Day Translation",
    year = "2020",
    publisher = "Association for Machine Translation in the Americas",
    url = "https://www.aclweb.org/anthology/2020.amta-pemdt.7",
    pages = "93--108",
}

@inproceedings{albo-jamara-etal-2021-mid,
    title = "Mid-Air Hand Gestures for Post-Editing of Machine Translation",
    author = {Albo Jamara, Rashad  and Herbig, Nico and Kr{\"u}ger, Antonio and van Genabith, Josef},
    booktitle = "Proceedings of the 59th Annual Meeting of the Association for Computational Linguistics and the 11th International Joint Conference on Natural Language Processing (Volume 1: Long Papers)",
    year = "2021",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2021.acl-long.527",
    doi = "10.18653/v1/2021.acl-long.527",
    pages = "6763--6773",
}

@inproceedings{shenoy-etal-2021-investigating,
    title = "Investigating the Helpfulness of Word-Level Quality Estimation for Post-Editing Machine Translation Output",
    author = {Shenoy, Raksha and Herbig, Nico and Kr{\"u}ger, Antonio and van Genabith, Josef},
    booktitle = "Proceedings of the 2021 Conference on Empirical Methods in Natural Language Processing",
    year = "2021",
    publisher = "Association for Computational Linguistics",
    url = "https://aclanthology.org/2021.emnlp-main.799",
    pages = "10173--10185",
}
```

## Notes regarding logging <a name="logging"></a>
We support extensive logging functionality. On the one hand, actual keystrokes, touched pixel coordinates, and other events are logged and all UI interactions (like segmentChange or undo/redo/confirm) are stored, allowing us to analyze the translator’s use of MMPE. Most importantly, however, we also log all text manipulations on a higher level to simplify text editing analysis.

For insertions, we log whether a single or multiple words were inserted, and add the actual words and their positions as well as the segment’s content before and after the insertion to the log entry.

Deletions are logged analogously, and for reorderings, we save the old and the new position of the moved word(s) to the log entry.
Last, for replacements, we log whether only a part of a word was replaced (i.e., changing the word form), whether the whole word was replaced (i.e., correcting the lexical choice), or whether a group of words was replaced. The logs for copy and paste have been improved by adding the clipboard content.

In all cases, the word(s) before and after the change, as well as their positions and the overall segment text, are specified in the log entry. Furthermore, all log entries contain the modality of the interaction, e.g., speech or pen, thereby allowing the analysis
of which modality was used for which editing operation. All log entries with timestamps are created within the client and sent to the server for storage in a JSON file.

The logging functionality was extended, such that times between clicking “Start” and confirming the segment were also logged. Furthermore, logging for multimodal commands: We do not merely save whether the interaction was multi-modal, but store whether it was a combination of speech and pen, or speech and mouse, or speech and finger touch.

![Logging of text manipulations in an easily interpretable granularity](/assets/imgs/logging.PNG)


## Notes regarding touch and pen functionality <a name="touch-and-pen"></a>
![Handwriting](/assets/imgs/handwriting.png)

![Touch Selection](/assets/imgs/touchSelect.jpg)

![Touch Reordering](/assets/imgs/touchReorder.jpg)

**Configuring myScript**
For handwriting recogntion, we use the myScript API. You first need to get your credentials by registering on their site.
Then insert the retrieved myScriptApplicationKey and myScriptHmacKey in mmpe-frontend/src/assets/config.json as in the example in mmpe-frontend/src/assets/config.json.example.
You can also define the language there using myScript's language codes. Note however, that we only ran studies with de_DE as target language yet, so test well if you change this value.

**Configuring Windows**
By default Windows offers a handwriting recognition. As we are using myScript, we decided to disable this. To know how, 
see https://superuser.com/questions/951229/how-to-disable-windows-10-handwritting-dialog  
Note: If you are using a German Windows, the service you are looking for is called 'Dienst für Bildschirmtastatur und Schreibbereich'.

If your finger touches are sent to the wrong screen, go to Tablet-PC settings on Windows 10, and click setup. If you cannot find these settings, open run and type shell:::{80F3F1D5-FECA-45F3-BC32-752C152E456E}.

**Configuring Cintiq Screens**
The button in the pen was confusing for some participants who accidentally pushed it. 
We therefore recommend deactivating it in the Cintiq settings.

## Notes regarding eye tracking functionality <a name="eye-tracking"></a>
![Eye Tracking](/assets/imgs/eyeTracking_part.png)

As an eye tracker, we currently support the Tobii 4C with Pro SDK and Pupil Labs eye trackers with the Pupil Core SDK:

For the Tobii 4C with Pro SDK:
- Install the Tobii Software on your PC
- Calibrate the eye tracker for every participant
- Activate the Tobii eye tracker in the front-end

For the Pupil Labs integration:
- Install the Pupil Capture software
- Register your monitor as a surface in the Pupil Capture software by using fiducial markers as described on their website.
- Calibrate the eye tracker
- Activate the Pupil eye tracker in the front-end

Selecting any eye tracker in the frontend will launch the corresponding python script on in mmpe-server/eyeTracking/python.
Both eye tracker have not been used in studies yet, so the implementation might still contain some bugs, but we are happy to help out if you want to give it a try.

For integrating another eye tracker, have a look at one of the python scripts (or test.py) in the folder mmpe-server/eyeTracking/python. They all do the same: use the eye tracker's SDK to generate our own events:
- Gaze events, like {'gaze': {'ts': \<someTimeStamp\>, 'left': {'gaze': {'x': \<someXValue\>, 'y': \<someYValue\>, 'val': \<ifTheGazeIsValid\>, 'pupil': {'diam': \<theDiameter\>, 'valid': \<aValidityScore\>}, 'right': {'gaze': {'x': \<someXValue\>, 'y': \<someYValue\>, 'valid': \<ifTheGazeIsValid\>, 'pupil': {'diam': \<theDiameter\>, 'valid': \<aValidityScore\>}}}
    - the data is simply fetched using the Eye Tracker SDK
- Fixation events  
    - {'fixationStart': {'x': \<centerOfFixationX\>, 'y': \<centerOfFixationY\>, 'ts': \<timestamp\>}}
    - {'fixationEnd': {'x': \<centerOfFixationX\>, 'y': \<centerOfFixationY\>, 'duration': \<fixationDuration\>, 'dispersion': \<fixationDispersion\>, 'ts': \<timestamp\>}}
    - These are calculated using a simple dispersion algorithm in utils.py.

If you want to integrate another eye tracker, just use its SDK and transform what it returns into the above events. Then everythign else should work automatically.

These events are simply forwarded to the mmpe-frontend's eye service. 
- gaze events are simply visualized (the orange circle in the image above)
- fixation events are used for 2 purposes
    - inform the speech service if a fixation happened on the currently edited target view, so that simplified multi-modal commands can be executed. In the image above, the yellow circle on the target shows the last fixation, and the yellow highlighted word the word that this fixation was mapped to.
    - memorize and visualize the last fixation on the source and target to help the translator find where s/he left off. In the image above, the yellow circle on the source is such a fixation.

Naturally, the implementation with a python file being launched on the server requires the server to run on the same machine that you run the front-end on. For studies this is fine, so we saved ourselves some effort here. In a proper client-server architecture, you would need to move the eye tracker integration into browser plugins.

## Notes regarding speech and multi-modal functionality <a name="speech-and-multi-modal"></a>
![Before Speech Command](/assets/imgs/speechBefore.png)

![After Speech Command](/assets/imgs/speechAfter.png)


When activating speech, the browser will ask you for permission to access a microphone. Make sure to the best microphone you have from the list (if you have multiple ones).

Speech is then being recorded and streamed from mmpe-frontend to mmpe-server, and from there to IBM Watson servers. To make this work, you need to specify the fields in the mmpe-server/config.json. To see how the file should look, see the mmpe-server/config.json.example.
Insert your credentials and speech model in that file.

Furthermore, specify the speech language in mmpe-fronend/src/assets/config.json, e.g. 'de-De'. IBM Watson also offers customization, e.g. to train a model more towards the MT text can help to improve the transcription. If you do that on their platform, you can insert the customization ID as a string in the same config under "speechModelCustomizationID".

Now the mmpe-server receives a transcription from IBM Watson, which he forwards to mmpe-client's speech.service.ts. This speech service now uses speech commands to interpret the transcription. We tried to keep the commands and the source code separate. See below "Supporting further languages for speech interaction" for further information on the commands.

![Before Multi-Modal Speech Command](/assets/imgs/multiModalBefore.png)

![After Multi-Modal Speech Command](/assets/imgs/multiModalAfter.png)

The speech.service.ts is also informed about interactions from other modalities, like cursor placement through mouse, keyboard, touch, pen, or just the fixations from eye tracking. It uses this to support simplified commands where the entitiy is specified through the other modality.

### Supporting further languages for speech interaction

The speech commands can be found in mmpe-server/ibmSpeech/jsonFiles. The commands file there specifies the operations that can be done. The synonyms file, specifies synonyms for the commands. As you see, the commands.json is kept in english, but this is not actual english but just placeholders that are used to map real words using the synonyms file. As we ran our experiments in German, we currently only have a synonyms_de-DE.json file. In theory, similar files can be quickly created for any language, but we have not seriously tested this. We are however, happy to support your efforts to integrate further languages.

Here is quick description of the synonym_de-DE.json file, which can help create similar files for other languages:

The synonym_de-DE.json file assists in mapping target language (German) speech commands to its corresponding commands in commands.json, which are then processed to obtain the final result. This JSON file should be rather intuitive: it supports various operations like delete, insert, move, replace, confirm, undo and redo. Each of these operations are mapped to multiple words in the target language. Similarly, there are number and keyword mappings to support multimodal commands like "Lösche zwei wörter.", "ersetze vier wörter durch Kunden." and "Bewege vier wörter nach Kunden.". Furthermore, keyword and count mappings are included to support commands like "Lösche erstes Wort", "Lösche fünftes Wort am Ende", "er setze satz durch vinyl". Additionally, preposition, conjunction and punctuation mappings are also included. In order to support other language pairs, a new synonyms.json file needs to be provided with the source-target mappings. Also note how this file can be easily used to fix transcription errors: in German, we frequently received "er setze" instead of "ersetze" from Watson, but supporting this is as simple as adding it to the list of German words for the "replace" operation.

## Notes regarding mid-air gesture functionality <a name="mid-air-gesture"></a>
Note: This feature is based on the Master’s thesis “Using Hand Gestures for Text Editing Tasks in Post-Editing of Machine Translation” by Rashad Albo Jamara, and the corresponding ACL 2021 paper "Mid-Air Hand Gestures for Post-Editing of Machine Translation".

Leap Motion Controller enables you to use mid-air gestures with the minimum requirements. The following steps will guide you to install and use it.

The following instructions apply to Windows, but it should work similarly for other operating systems.
1. Download Leap Motion Controller SDK from: https://developer.leapmotion.com/releases/leap-motion-orion-321
2. Install with administrative permissions
3. Connect your Leap Motion Controller to your PC via USB port version 2.0 or 3.0 
4. Run Leap Motion SDK and navigate to General tap, then tick the option **Allow Web Apps**
![Enable Webapps](/assets/imgs/enableWebApps.png
)
5. Make sure that the Leap Motion Controller is actively tracking. There are two ways to do this:
    *  Right click on the SDK icon in your taskbar and click "Resume Tracking". If already activated the icon is displayed green
    ![Resume Tracking](/assets/imgs/midairGesturesResume.png)
    *  You can notice a red color led is on, on top Leap Motion Controller
6. Open the MMPE project and activate mid-air gestures in the navigation bar
    ![Activate Gestures](/assets/imgs/activateMidairGesture.png)
7. Set your sensitivty preferences in the right-hand side panel after activating mid-air gestures
    ![Gesture Sensitivity](/assets/imgs/midairGestureSensitivity.png)

## Notes regarding quality estimation functionality <a name="quality-estimation"></a>
Note: This feature is based on the Master’s thesis “ImpoWord MTQE: Impact of Word-Level Machine Translation Quality Estimation on Post-Editing Effort” by Raksha Shenoy, and the corresponding EMNLP 2021 paper "Investigating the Helpfulness of Word-Level Quality Estimation for Post-Editing Machine Translation Output".

We explored word-level quality estimation to support the post-editing process. 
Since this project focuses on the front-end, we do not include a real QE system here, but use existing QE tools to create word-level annotations. 
If you want to use our word-level QE visualizations, use a QE system to generate an array per sentence defining which words are probably correct/incorrect. 

1) The QE annotations from the real QE model and fake QE models are stored as an array corresponding to the key "qualityLabels" in the JSON file (from 1 meaning best quality to 6 meaning worst quality). For this, we converted the QE outputs from [0,1] to 1, 2, 3, 4, 5, 6. When a user changes a word, the "qualityLabels" array at the index of the word gets value "NEUTRAL". If words are added/deleted, the "qualityLabels" array gets longer/shorter.
    ```json
        "qualityLabels": [1,2,3,4,2,1,4,5,3,2,1,6],
        "colorLabels": [1,2,3,4,2,1,4,5,3,2,1,6],
        "mode": "Binary"
    ```
    The value corresponding to the JSON-key "mode" indicates the visualization scheme 
    ("Binary" or "Gradient"). The value corresponding to the JSON-key "colorLabels" has identical array elements as qualityLabels before any edits are done and is used in case the user wants to reset the edit area. Therefore, the JSON file is extended to incorporate "qualityLabels", "colorLabels" and "mode".
2) To enable quality estimation visualization, enableQualityEstimation field in the mmpe-frontend/src/assets/config.json should be set to true.
3) The client-side code has the logic to visualize the quality estimates from the extended JSON as either binary or gradient depending on the "mode". The extended JSON files are stored in mmpe_frontend/mmpe-server/data/projects/GeneratedProjectsQEStudy.zip
![Prototype](/assets/imgs/Quality_Estimation.PNG)
3) When the user post-edits the words in the segment, the changed words turn black.
![Color Adaptation](/assets/imgs/Color_Adaptation_afterPE.PNG)
4) In the user study studying the impact of word-level QE on PE effort, we had a pop asking the user of the word-level QE was helpful after every segment confirm.
![Pop Up](/assets/imgs/QE_Pop-up.png). The clicked selection is stored in the log file. The shown pop-up can be found in mmpe-frontend/src/app/components/segment-detail/study-dialogQE.html. 
   As discussed above, segment-detail.component.ts/StudyDialog defines the popup that is shown.

## Notes regarding interactive post-editing (IPE) functionality <a name="ipe"></a>
Note: This feature is based on the Master’s thesis “IPE: Enhancing Visualization of Multiple Alternatives for Interactive Post-Editing” by Atika Akmal.

In Interactive Post-Editing, the user can post-edit a translated text by clicking on any word in the translation, which they want to change.
To improve human-machine collaboration, we enhanced the visualization of multiple alternatives given by machine for the selected word during interactive post-editing. We used three different approaches to visualize the multiple alternatives as MMPE (DeepL, LMM, and LCD). MMPE-DeepL is a re-implementation of the DeepL tool to be compared to the other two ideas.
1) To enable the IPE feature, the value of the "enableIPE" field in the mmpe-frontend/src/assets/config.json should be set true. 
2) For interactive post-editing (IPE), the user can single-click on any word in the translation, and the popup with only one of the three visualizations, e.g., MMPE (DeepL, LMM, and LCD) as defined in the project file, will open. 
3) The following image shows the MMPE-DeepL visualization. We did not highlight the changes and did not cluster the given alternatives because we want to keep consistent with the DeepL tool compared to other proposed approaches. 
![Pop Up](/assets/imgs/mmpe-deepl.png)
4) MMPE-LMM: categorized multiple alternatives into lexical, minor, and major changes. The first block shows the lexical changes, while the following blocks represent the minor and major changes, as shown below in Figure.
![Pop Up](/assets/imgs/mmpe-lmm.png) 

5) MMPE-LCD: is comprised of lexical, consecutive, and distant changes. In the following image, the first block represents the lexical changes, and the second and third blocks consist of consecutive and distant changes.
![Pop Up](/assets/imgs/mmpe-lcd.png)

6) Highlighting changes: In the above Figures, the newly inserted words are highlighted with green color, and the deleted words are highlighted with red color. Moreover, the stars in front of each proposal is the confidence score given by the machine.
