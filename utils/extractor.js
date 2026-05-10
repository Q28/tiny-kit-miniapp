function extractFirstUrl(text) {
  if (!text || typeof text !== "string") {
    return "";
  }

  const urlRegex = /(https?:\/\/[^\s]+)/i;
  const match = text.match(urlRegex);
  if (!match) {
    return "";
  }

  return match[0].replace(/[),.;!?]+$/, "");
}

module.exports = {
  extractFirstUrl
};
