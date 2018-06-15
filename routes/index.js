const express = require('express');
const router = express.Router();
const ConversationV1 = require('watson-developer-cloud/conversation/v1');
const _ = require('lodash');

const conversation = new ConversationV1(Object.assign(require('../watson-credentials.json'), { version_date: ConversationV1.VERSION_DATE_2017_05_26 }));

let context; // use global for now

router.post('/*', (req, res, next) => {
	let intent;
	if (req.body.request.intent) {
		intent = req.body.request.intent.name;
	}
	if (!intent || intent === 'AMAZON.StopIntent') {
		respond(res, "Bis bald.");
	} else {
		const spoken = req.body.request.intent.slots.EveryThingSlot.value;
		sendToWatson(spoken, (err, watsonResponse) => {
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

function sendToWatson(spokenRequest, cb) {
	conversation.message({
		input: { text: spokenRequest },
		context,
		workspace_id: 'dcec2db0-5a2b-424c-9dc5-0dcff4225721'
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