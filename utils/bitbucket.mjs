import FormData from "form-data";
import fs from "fs";
import fetch from "node-fetch";

const BITBUCKET_URL =
  'https://api.bitbucket.org/2.0/repositories/onemen/tabmixplus-for-firefox/downloads';

async function bitbucketUpload() {
  const formData = new FormData();
  const filePath = `${process.env.XPI_NAME}.xpi`;
  const readStream = fs.createReadStream(filePath);
  formData.append("files", readStream);

  const headers = new Headers({
    Authorization: `Bearer ${process.env.BITBUCKET_ACCESS_TOKEN}`,
    "Content-Type": `multipart/form-data; boundary=${formData.getBoundary()}`,
  });

  const response = await fetch(BITBUCKET_URL, {method: "POST", body: formData, headers});
  console.log({response});
  if (response.ok) {
    console.log(`File ${filePath} was uploaded to bitbucket downloads page`);
  } else {
    const text = await response.text();
    console.log("Error uploading file:", text, response.status, response.statusText);
  }
}

bitbucketUpload();
