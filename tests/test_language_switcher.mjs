successfully downloaded text file (SHA: 091471b8206cac3703a4fbf1d96c64a2f9579846)
assert.match(source,/MHP_LANG_ARIA/,'Language switcher must localize its accessible label');
assert.match(source,/meta\[property=\"og:title\"\]/,'Language changes must keep Open Graph metadata synchronized');
assert.match(source,/link\[rel=\"canonical\"\]/,'Language changes must keep canonical URL synchronized');
