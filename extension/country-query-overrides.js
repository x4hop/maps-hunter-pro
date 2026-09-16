// Keep search-country selection aligned with the phone-country selector.
function buildCityQuery(keyword, city, countryCode) {
  const safeKeyword = clean(keyword);
  const safeCity = clean(city);
  const names = {
    "218":"Libya","20":"Egypt","216":"Tunisia","213":"Algeria","212":"Morocco",
    "966":"Saudi Arabia","971":"United Arab Emirates","974":"Qatar","965":"Kuwait",
    "973":"Bahrain","968":"Oman","962":"Jordan","961":"Lebanon","964":"Iraq",
    "90":"Turkey","49":"Germany","44":"United Kingdom","33":"France","39":"Italy",
    "34":"Spain","7":"Russia","1":"United States"
  };
  const country = names[clean(countryCode)] || "";
  const alreadyNamed = country && safeCity.toLowerCase().includes(country.toLowerCase());
  return `${safeKeyword} near ${safeCity}${country && !alreadyNamed ? `, ${country}` : ""}`;
}
