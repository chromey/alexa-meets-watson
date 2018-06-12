const express = require('express');
const router = express.Router();
const request = require('request');
const ConversationV1 = require('watson-developer-cloud/conversation/v1');
const _ = require('lodash');

const conversation = new ConversationV1(Object.assign(require('../watson-credentials.json'), { version_date: ConversationV1.VERSION_DATE_2017_05_26 }));

router.get('/*', function (req, res, next) {
	// res.json({ ok: req.query });
	conversation.message({
		input: { text: "anything to do today?" },
		workspace_id: 'xxx'
	}, (err, response) => {
		if (err) {
			console.error(err);
			res.json(err);
		} else {
			console.log(JSON.stringify(response, null, 2));
			res.json(response);
		}
	});
});

let context; // use global for now

router.post('/*', (req, res, next) => {
	let intent;
	if (req.body.request.intent) {
		intent = req.body.request.intent.name;
	}
	const lang = req.body.request.locale.substr(0, 2);
	if (!intent || intent === 'AMAZON.StopIntent') {
		respond(res, "Bis bald.");
	} else {
		const spoken = req.body.request.intent.slots.EveryThingSlot.value;
		sendToWatson(spoken, lang, (err, watsonResponse) => {
			if (err) {
				console.log('--ERR', err);
				return respond(res, 'Bis bald');
			}
			console.log('--RESPONSE', JSON.stringify(watsonResponse, null, 2));
			respond(res, watsonResponse);
		});
	}
});

module.exports = router;

function respond(res, watsonResponse) {
	let text, shouldEndSession, ctx;
	if (typeof watsonResponse === 'string') {
		text = watsonResponse;
		shouldEndSession = true;
		ctx = null;
	} else {
		text = _.sample(watsonResponse.output.text);
		shouldEndSession = !!watsonResponse.output.finishConversation;
		ctx = watsonResponse.context;
	}
	updateContext(ctx, shouldEndSession);
	res.json({
		version: '1.0',
		response: {
			shouldEndSession,
			outputSpeech: {
				type: 'PlainText',
				text
			}
		}
	});
}

const workspaces = {
	en: '04ad5565-8fa9-444c-bdba-02de8e3ea396',
	de: 'dcec2db0-5a2b-424c-9dc5-0dcff4225721'
}

function sendToWatson(spokenRequest, lang, cb) {
	conversation.message({
		input: { text: spokenRequest },
		context,
		workspace_id: workspaces[lang]
	}, cb);
}

function updateContext(ctx, shouldEndSession) {
	if (shouldEndSession || !ctx) {
		context = null;
		return;
	}
	context = ctx;
	// if context did not change in the last 30 seconds, remove it
	_.delay(oldContext => {
		if (oldContext === context) {
			context = null;
			console.log('conversation context removed due to inactivity');
		}
	}, 30000, context);
}