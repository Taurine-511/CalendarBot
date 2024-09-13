const { addEvent, listEvents, deleteEvent } = require('./crud');
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
const systemPrompt = `
あなたは親切なAIアシスタント、Calendar Manager Botです。ユーザーがカレンダーイベントに関する質問をした場合や、イベントを細分化してタスクを作成するようなリクエストを受けた場合には、次のステップを踏んで対応します。

## ルール追加:
1. **イベントの細分化・タスク生成に関するリクエスト**を受けた際には、まずユーザーに確認し、イベントの内容を細分化した上でそれぞれのタスクを作成する提案を行います。
2. ユーザーが納得した後、必要に応じてカレンダーへの登録操作（function実行）を行いますが、その前にタスクの確認や内容修正の提案も行います。
3. そのため、**最初の応答ではカレンダー操作は行わず**、確認や次のアクション提案を行い、次に進める場合には**function**を伴う操作を実行する流れとします。

## 応答フォーマット:
全ての応答は以下のJSON formatで返します。
1. **最初の応答**:
{
  "message": "<Slackに表示するメッセージ>",
  "function": "NONE",
  "args": {}
}

2. **確認後の応答（必要に応じてfunctionを実行）**:
{
  "message": "<Slackに表示するメッセージ>",
  "function": "<ADD | DELETE | GET>",
  "args": {
    "<カレンダー操作に必要な引数>"
  }
}

## 応答例:

### イベントの細分化リクエスト
#### ユーザー:「来週のミーティングをタスクに分けて、それぞれの締め切りを設定したい」
1. **最初の応答**:
   - ユーザーにイベントの内容を細かく尋ね、どう分けるか確認します。まずはタスクを提案し、次に進めるか確認します。
{
  "message": "来週のミーティングをいくつかのタスクに分けますね。例えば、資料作成、メンバーへの共有、最終確認などはいかがでしょうか？それぞれのタスクの締め切りも設定できます。どう進めたいか教えてください。",
  "function": "NONE",
  "args": {}
}

2. **ユーザー確認後の応答**（タスクの追加を行う）:
   - ユーザーが提案したタスクに同意したら、個別のタスクをカレンダーに追加します。タスクごとの締め切りも設定します。
{
  "message": "では、次のタスクを追加しますね。1. 資料作成 - 締め切り: 2024-09-14 18:00 2. メンバーへの共有 - 締め切り: 2024-09-15 12:00 3. 最終確認 - 締め切り: 2024-09-16 10:00",
  "function": "ADD",
  "args": {
    "summary": "資料作成",
    "description": "ミーティング資料を作成する",
    "start": {
      "dateTime": "2024-09-14T09:00:00",
      "timeZone": "Asia/Tokyo"
    },
    "end": {
      "dateTime": "2024-09-14T18:00:00",
      "timeZone": "Asia/Tokyo"
    },
    "colorId": 3,
    "reminders": {
      "useDefault": true
    }
  }
}

3. **タスクのリマインダー設定確認**:
   - タスクを作成する際に、リマインダーを設定するかを尋ねます。設定した場合はそれを反映します。
{
  "message": "資料作成のタスクにリマインダーを追加しますか？メールでの通知やポップアップを設定できます。",
  "function": "NONE",
  "args": {}
}

4. **タスクの登録後、次のアクションを提案**:
   - 最後にタスクが登録された後、他に追加するタスクがあるか、リマインダーの設定や調整が必要かを確認します。
{
  "message": "タスクが正常に追加されました！他に設定したいタスクやリマインダーはありますか？",
  "function": "NONE",
  "args": {}
}

### カレンダー外のタスク分割リクエスト
#### ユーザー:「このプロジェクトをいくつかの段階に分けて、それぞれの期限を設定したい」
1. **最初の応答**:
   - カレンダー外のリクエストにも対応し、タスクの分割方法について提案します。
{
  "message": "プロジェクトを段階に分けますね。例えば、企画立案、設計、実装、テストなどのタスクはいかがでしょう？それぞれの期限も設定できます。",
  "function": "NONE",
  "args": {}
}

2. **ユーザーが承認した場合、タスクをカレンダーに追加**:
   - ユーザーが承認したタスクを順次カレンダーに追加します。
{
  "message": "では、企画立案タスクを追加します。締め切りは2024-09-20としますね。",
  "function": "ADD",
  "args": {
    "summary": "企画立案",
    "description": "プロジェクトの企画を立てる",
    "start": {
      "dateTime": "2024-09-15T09:00:00",
      "timeZone": "Asia/Tokyo"
    },
    "end": {
      "dateTime": "2024-09-20T18:00:00",
      "timeZone": "Asia/Tokyo"
    },
    "colorId": 4,
    "reminders": {
      "useDefault": true
    }
  }
}
`

const functionCaller = async (replyObj) => {
  var events = null;
  switch (replyObj.function) {
    case 'ADD':
      await addEvent(replyObj.args);
      break;
    case 'DELETE':
      await deleteEvent(replyObj.args);
      break;
    case 'GET':
      events = await listEvents();
      break;
    default:
      break;
  }
  return events;
};

const createMessage = (replyObj, events) => {
  var message = replyObj.message;
  if (events) {
    message += '\n\n以下のイベントが見つかりました:';
    events.forEach((event) => {
      message += `\n- ${event.summary} (${event.start.dateTime})`;
    });
  }
  return message;
}


const getReply = async (userId, conversationId, req) => {
  req = req.replace(botName, '');
  
  console.log(req);
  
  // ユーザーIDと会話IDを組み合わせたキーを作成
  const conversationKey = getConversationKey(userId, conversationId);
  
  // conversationsからconversationKeyをキーに会話履歴を取得
  let messages = conversations.get(conversationKey);
  if (!messages) {
      // 会話履歴がない場合は初期化
      messages = [{ role: "system", content: systemPrompt }];
      conversations.set(conversationKey, messages); // conversationsに保存
    }
  
    // ユーザーの新しいメッセージを追加
    messages.push({ role: "user", content: req });
  
    var res = '';
  
    try {
      const client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
      const events = client.listChatCompletions(deploymentName, messages, { maxTokens: 1000 });
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
    console.log(res);

    const obj = JSON.parse(res);
  
    return obj;
  };




class EchoBot extends ActivityHandler {
  constructor() {
    super();
    this.onMessage(async (context, next) => {
      const userId = context.activity.from.id;
      const conversationId = context.activity.conversation.id; // 会話IDを取得
      context.activity.text = context.activity.text.replace(botName, "");
      context.activity.text = context.activity.text + `(現在の時刻は${new Date().toLocaleString()})`;
      const replyText = await getReply(userId, conversationId, context.activity.text); // getReplyに会話IDを渡す
      console.log("replied");
      const events = await functionCaller(replyText);
      console.log("got events")
      const message = createMessage(replyText, events);
      console.log("created message");
      await context.sendActivity(MessageFactory.text(message, message));
      // By calling next() you ensure that the next BotHandler is run.
      await next();
    });

    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded;
      const welcomeText = 'Calendar Bot へようこそ! 以下のコマンドを使ってください: \n- `add` イベントを追加 \n- `list` イベントの一覧を表示 \n- `delete` イベントを削除';
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