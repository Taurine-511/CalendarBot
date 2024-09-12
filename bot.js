const { ActivityHandler, MessageFactory } = require('botbuilder');
const { OpenAIClient } = require("@azure/openai");
const { AzureKeyCredential } = require("@azure/core-auth")

// 環境変数
const endpoint = process.env.EndPoint;
const apiKey = process.env.ApiKey;
const botName = process.env.BotName;

const deploymentName = 'gpt4';

// ユーザーごと、会話ごとの会話履歴を保持するためのマップ
const conversations = new Map();

const getConversationKey = (userId, conversationId) => {
return `${userId}-${conversationId}`;
};

const getReply = async (userId, conversationId, req) => {
req = req.replace(botName, '');

console.log(req);

// ユーザーIDと会話IDを組み合わせたキーを作成
const conversationKey = getConversationKey(userId, conversationId);

// conversationsからconversationKeyをキーに会話履歴を取得
let messages = conversations.get(conversationKey);
if (!messages) {
    // 会話履歴がない場合は初期化
    messages = [{ role: "system", content: "あなたは親切なアシスタントです。" }];
    conversations.set(conversationKey, messages); // conversationsに保存
  }

  // ユーザーの新しいメッセージを追加
  messages.push({ role: "user", content: req });

  var res = '';

  try {
    const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
    const events = client.listChatCompletions(deploymentName, messages, { maxTokens: 256 });
    for await (const event of events) {
      for (const choice of event.choices) {
        const delta = choice.delta?.content;
        if (delta !== undefined) {
          res += delta;
        }
      }
    }
    // アシスタントの返信を会話履歴に追加
    messages.push({ role: "assistant", content: res });
    // conversationsは更新済みなので保存の必要なし
  } catch (err) {
    console.log(err);
    throw err;
  }

  return res;
};



class EchoBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const userId = context.activity.from.id;
      const conversationId = context.activity.conversation.id; // 会話IDを取得
      context.activity.text = context.activity.text.replace(botName, "");
      const replyText = await getReply(userId, conversationId, context.activity.text); // getReplyに会話IDを渡す
      await context.sendActivity(MessageFactory.text(replyText, replyText));
      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = '質問をどうぞ！';
      for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
        if (membersAdded[cnt].id !== context.activity.recipient.id) {
          await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
        }
      }
      await next();
    });
  }
}

module.exports.EchoBot = EchoBot;