const parsePhoneNumber = require('libphonenumber-js');

exports.phoneNormalize = (phoneString) => {
  let phone = {};
  if (phoneString) {
    if (phoneString.match(/^[3\d\d]\d{7}$/)) phoneString = '+39 ' + phoneString;
    if (phoneString.match(/^[^30+]/)) phoneString = '+' + phoneString;
    phone = parsePhoneNumber(phoneString, 'IT');
  } else {
    phone.isNull = true;
  }
  let retval = {country: null, countryCallingCode: null, nationalNumber: null, number: null };
  if (phone && !phone.isNull && phone.isValid()) {
    retval = {country: phone.country, countryCallingCode: '+' + phone.countryCallingCode, nationalNumber: phone.nationalNumber, number: '+' + phone.countryCallingCode + '-' +  phone.nationalNumber };
  }
  return retval;
}