// https://developers.google.com/gmail/api/quickstart/nodejs?hl=ja
import { authenticate } from "npm:@google-cloud/local-auth";
import { google } from "npm:googleapis";
import { OAuth2Client } from "npm:google-auth-library";
// import {
//   encodeBase64,
//   decodeBase64,
// } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// If modifying these scopes, delete token.json.
// const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']; // for read only
// const SCOPES = ['https://www.googleapis.com/auth/gmail.modify']; // for read and write
const SCOPES = ["https://mail.google.com/"]; // for batch delete
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "./token.json";
const CREDENTIALS_PATH = "./credentials.json";

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await Deno.readTextFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch (_err) {
    return null;
  }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client: OAuth2Client) {
  const content = await Deno.readTextFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await Deno.writeTextFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client?.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Lists the labels in the user's account.
 *
 * @param {OAuth2Client} auth An authorized OAuth2 client.
 */
async function listLabels(auth: OAuth2Client | null) {
  if (!auth) {
    throw new Error("No credentials");
  }
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.labels.list({
    userId: "me",
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log("No labels found.");
    return;
  }
  console.log("Labels:");
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}

async function listMessages(
  auth: OAuth2Client | null,
  labelIds: string[] = [],
) {
  if (!auth) {
    throw new Error("No credentials");
  }
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 10,
    labelIds,
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log("No messages found");
    return;
  }
  console.log("Messages:");
  messages.forEach((message) => {
    // console.log(`- ${message.id}`);
    console.log(message);
  });
}

async function getMessages(auth: OAuth2Client | null, labelIds: string[] = []) {
  if (!auth) {
    throw new Error("No credentials");
  }
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1,
    labelIds,
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log("No messages found");
    return;
  }
  messages.forEach((message) => {
    gmail.users.messages.get({
      userId: "me",
      id: message.id,
    })
      .then((res) => {
        const { headers } = res.data.payload;
        // const { headers, body } = res.data.payload;
        // console.log('headers:', headers);
        const subjectHeader = headers.find((header) =>
          header.name === "Subject"
        );
        const fromHeader = headers.find((header) => header.name === "From");
        const subjectValue = subjectHeader ? subjectHeader.value : "";
        const fromValue = fromHeader ? fromHeader.value : "";
        console.log(subjectValue);
        console.log(fromValue);
        // const bodyData = body.data || '';
        // console.log(bodyData);
        // const bodyDecoded = bodyData ? decodeBase64(bodyData) : '';
        // console.log(bodyDecoded);
      })
      .catch((err) => {
        console.error(err);
      });
  });
}

async function deleteMessages(
  auth: OAuth2Client | null,
  labelIds: string[] = [],
) {
  if (!auth) {
    throw new Error("No credentials");
  }
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1000,
    labelIds,
  });
  const messages = res.data.messages;
  if (!messages || messages.length === 0) {
    console.log("No messages found");
    return;
  }
  const messageIds = messages.map((message) => message.id);
  const batchDeleteRes = await gmail.users.messages.batchDelete({
    userId: "me",
    requestBody: {
      ids: messageIds,
    },
  });
  console.log(batchDeleteRes);
}

// authorize().then(listLabels).catch(console.error);
// authorize().then(listMessages).catch(console.error);
// authorize().then((auth) => {
//   listMessages(auth, ['CATEGORY_PROMOTIONS']);
// }).catch(console.error);
// authorize().then((auth) => {
//   getMessages(auth, ['CATEGORY_PROMOTIONS']);
// }).catch(console.error)
authorize().then((auth) => {
  deleteMessages(auth, ["CATEGORY_PROMOTIONS"]);
}).catch(console.error);
