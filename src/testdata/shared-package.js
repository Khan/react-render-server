KAdefine("javascript/shared-package/ka.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * The KA variable is actually defined in templates/macros/app.html, because it
 * relies on jinja templated data. We want to have some mechanism to require
 * them so we can disallow the use of global variables as much as possible,
 * which is where this file comes in. Instead of doing:
 *
 *  var user = window.KA.getUserProfile();
 *
 * Now you can do this:
 *
 *  var KA = require("../shared-package/ka.js");
 *  var user = KA.getUserProfile();
 *
 * TODO(jlfwong): Define only data in macros/app.html, and move all function
 * definitions here to provide a clearer interface and provide better mocking
 * via sinon in tests. This will remove the necessity of the stub in
 * javascript/testutil.js.
 */
var KA = window.KA = Object.assign(window.KA || {}, { 
    // The Backbone ProfileModel for the currently logged in user
    // or a phantom user. Will be null if the user is pre-phantom.
    userProfileModel_: null, 
    getUserProfile: function () {
        // Circular
        var ProfileModel = require("./profile-model.js");
        if (KA.userProfileData_ && !KA.userProfileModel_) {
            KA.userProfileModel_ = new ProfileModel(KA.userProfileData_);}

        return KA.userProfileModel_;}, 

    setUserProfile: function (attrs) {
        // Circular
        var ProfileModel = require("./profile-model.js");
        if (!KA.userProfileModel_) {
            KA.userProfileModel_ = new ProfileModel(attrs);}

        KA.userProfileModel_.set(attrs);
        return KA.userProfileModel_;}, 

    getGlobalPermissions: function () {
        var profile = KA.getUserProfile();
        return profile && profile.get("globalPermissions") || [];}, 

    isPhantom: function () {
        var profile = KA.getUserProfile();
        // The user is pre-phantom if there is no profile, so we
        // include it in this check.
        return !profile || profile.get("isPhantom");}, 

    isDeveloper: function () {
        var profile = KA.getUserProfile();
        return profile && profile.get("isDeveloper");} });



module.exports = KA;
});
KAdefine("javascript/shared-package/console.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, no-console, prefer-spread */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var KAConsole = { 
    _oldMessages: [], 

    _flushOldMessages: function () {
        for (var i = 0, l = this._oldMessages.length; i < l; i++) {
            this.log.apply(this, this._oldMessages[i]);}

        this._oldMessages = [];}, 


    /**
     * Saves all messages to a buffer. Used when no window.console is present,
     * or when KAConsole is disabled.
     *
     * @this {KAConsole}
     */
    _logToBuffer: function () {
        this._oldMessages.push(arguments);}, 


    /*
     * Used when KAConsole is enabled, but no window.console is present.
     * Saves all logs to the buffer but checks each time to see if a console
     * appears.
     *
     * @this {KAConsole}
     */
    _logOrPreserve: function () {
        if (window.console) {
            this.enable();
            this.log.apply(this, arguments);} else 
        {
            this._logToBuffer.apply(this, arguments);}}, 



    /*
     * Assumes a console is available, and passes arguments through. Does not
     * preserve line number of caller, so only used when console.log.bind is
     * not supported.
     */
    _logCompatible: function () {
        if (!window.console) {
            return;}

        if (console.log.apply) {
            console.log.apply(console, arguments);} else 
        {
            // IE8 compatibility
            Function.prototype.apply.call(console.log, null, arguments); // @Nolint
        }}, 


    /*
     * Enables display of log messages. Attempts to directly bind KAConsole.log
     * to console.log to preserve display of line numbers. If this is not
     * possible, falls back to a compatible method. If a console is not present
     * (IE 8 before dev tools are enabled), preserves logs until a console
     * appears.
     *
     * @this {KAConsole}
     */
    enable: function () {
        if (window.console) {
            if (console.log.bind) {// @Nolint
                // When possible, directly call the correctly bound console.log
                // function. This preserves line number display in the console.
                this.log = console.log.bind(console); // @Nolint
            } else {
                // We have a console, but don't support bind.
                this.log = this._logCompatible;}

            this._flushOldMessages();} else 
        {
            // There is no console, so record everything until a console becomes
            // available.
            this.log = this._logOrPreserve;}}, 



    disable: function () {
        this.log = this._logToBuffer;}, 


    /**
     * Initializes KAConsole.
     *
     * This function is safe to call multiple times.
     */
    init: function (enable) {
        if (enable) {
            this.enable();} else 
        {
            this.disable();}} };




// By default, leave the console disabled.
KAConsole.init(false);

module.exports = KAConsole;
});
KAdefine("javascript/shared-package/i18n.js", function(require, module, exports) {
var icu = require("icu");
var createFragment = require("react-addons-create-fragment");

// The plural language strings for all the languages we have
// listed in crowdin.  The values here need to match what crowdin
// uses (sometimes different platforms use different plural forms,
// for ambiguous languages like Turkish).  I got it by running
//    deploy/download_i18n.py -s
// and looking a the .po files in all.zip.  Each .po file has a
// header line that say something like:
//    "Plural-Forms: nplurals=2; plural=(n != 1);\n"
// which I copied in here with the following changes:
//    1) I only take the 'plural=' section, which I wrapped in a function
//    2) Changed 'or' to '||'
// These functions return either true or false or a number.  We map
// true to 1 and false to 0 below, to always get a number out of this.

/* eslint-disable space-infix-ops, eqeqeq, max-len */
var likeEnglish = function (n) {return n != 1;};

// TODO(csilvers): auto-generate this list from the foo.po files (in dropbox)
var allPluralForms = { 
    "accents": likeEnglish, // a 'fake' langauge
    "af": likeEnglish, 
    "ar": function (n) {return n == 0 ? 0 : n == 1 ? 1 : n == 2 ? 2 : n % 100 >= 3 && n % 100 <= 10 ? 3 : n % 100 >= 11 && n % 100 <= 99 ? 4 : 5;}, 
    "az": likeEnglish, 
    "bg": likeEnglish, 
    "bn": likeEnglish, 
    "boxes": likeEnglish, // a 'fake' langauge
    "ca": likeEnglish, 
    "cs": function (n) {return n == 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2;}, 
    "da": likeEnglish, 
    "de": likeEnglish, 
    "el": likeEnglish, 
    "empty": likeEnglish, // a 'fake' langauge
    "en": likeEnglish, 
    "en-pt": likeEnglish, // a 'fake' language, used by crowdin for JIPT
    "es": likeEnglish, 
    "fa": function (n) {return 0;}, 
    "fa-af": function (n) {return 0;}, 
    "fi": likeEnglish, 
    "fr": function (n) {return n > 1;}, 
    "he": likeEnglish, 
    "hi": likeEnglish, 
    "hu": likeEnglish, 
    "hy": likeEnglish, 
    "id": function (n) {return 0;}, 
    "it": likeEnglish, 
    "ja": function (n) {return 0;}, 
    "ko": function (n) {return 0;}, 
    "lol": likeEnglish, // a 'fake' langauge
    "mn": likeEnglish, 
    "ms": function (n) {return 0;}, 
    "nb": likeEnglish, 
    "nl": likeEnglish, 
    "pl": function (n) {return n == 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;}, 
    "pt": likeEnglish, 
    "pt-pt": likeEnglish, 
    "ro": function (n) {return n == 1 ? 0 : n == 0 || n % 100 > 0 && n % 100 < 20 ? 1 : 2;}, 
    "ru": function (n) {return n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;}, 
    "si-LK": likeEnglish, 
    "sk": function (n) {return n == 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2;}, 
    "sr": function (n) {return n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;}, 
    "sv-SE": likeEnglish, 
    "sw": likeEnglish, 
    "te": likeEnglish, 
    "th": function (n) {return 0;}, 
    "tr": function (n) {return 0;}, 
    "uk": function (n) {return n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2;}, 
    "ur": likeEnglish, 
    "vi": function (n) {return 0;}, 
    "xh": likeEnglish, 
    "zh-hans": function (n) {return 0;}, 
    "zh-hant": function (n) {return 0;}, 
    "zu": likeEnglish };

/* eslint-enable */

var interpolationMarker = /%\(([\w_]+)\)s/g;
/**
 * Performs sprintf-like %(name)s replacement on str, and returns a React
 * fragment of the string interleaved with those replacements. The replacements
 * can be any valid React node including strings and numbers.
 *
 * For example:
 *  interpolateStringToFragment("test", {}) ->
 *      test
 *  interpolateStringToFragment("test %(num)s", {num: 5}) ->
 *      test 5
 *  interpolateStringToFragment("test %(num)s", {num: <Count />}) ->
 *      test <Count />
 */
var interpolateStringToFragment = function (str, options) {
    options = options || {};

    // Split the string into its language fragments and substitutions
    var split = str.split(interpolationMarker);

    var result = { "text_0": split[0] };

    // Replace the substitutions with the appropriate option
    for (var i = 1; i < split.length; i += 2) {
        var key = split[i];
        var replaceWith = options[key];
        if (replaceWith === undefined) {
            replaceWith = "%(" + key + ")s";}


        // We prefix each substitution key with a number that increments each
        // time it's used, so "test %(num)s %(fruit)s and %(num)s again" turns
        // into an object with keys:
        // [text_0, 0_num, text_2, 0_fruit, text_4, 1_num, text_6]
        // This is better than just using the array index in the case that we
        // switch between two translated strings with the same variables.
        // Admittedly, an edge case.
        var j = 0;
        while ("" + j + "_" + key in result) {
            j++;}

        result["" + j + "_" + key] = replaceWith;
        // Because the regex has one capturing group, the `split` array always
        // has an odd number of elements, so this always stays in bounds.
        result["text_" + (i + 1)] = split[i + 1];}


    return createFragment(result);};


/**
    * Simple i18n method with sprintf-like %(name)s replacement
    * To be used like so:
    *   i18n._("Some string")
    *   i18n._("Hello %(name)s", {name: "John"})
    */
var _ = function (str, options) {
    // Sometimes we're given an argument that's meant for ngettext().  This
    // happens if the same string is used in both i18n._() and i18n.ngettext()
    // (.g. a = i18n._(foo); b = i18n.ngettext("foo", "bar", count);
    // In such cases, only the plural form ends up in the .po file, and
    // then it gets sent to us for the i18n._() case too.  No problem, though:
    // we'll just take the singular arg.
    if (typeof str === "object" && str.messages) {
        str = str.messages[0];}


    options = options || {};

    return str.replace(interpolationMarker, function (match, key) {
        var replaceWith = options[key];
        return replaceWith === undefined ? match : replaceWith;});};



/**
    * A simple i18n react component-like function to allow for string
    * interpolation destined for the output of a react render() function
    *
    * This function understands react components, or other things
    * renderable by react, passed in as props.
    *
    * Examples:
    *   <$_ first="Motoko" last="Kusanagi">
    *       Hello, %(first)s %(last)s!
    *   </$_>
    *
    * which react/jsx compiles to:
    *   $_({first: "Motoko", last: "Kusanagi"}, "Hello, %(first)s %(last)s!")
    *
    *
    *   <$_ textbox={<input type="text" />}>
    *       Please enter a number: %(textbox)s
    *   </$_>
    *
    * which react/jsx compiles to:
    *   $_({textbox: React.DOM.input({type: "text"}),
    *       "Please enter a number: %(textbox)s")
    *
    * Note: this is not a full react component to avoid complex handling of
    * other things added to props, such as this.props.ref and
    * this.props.children
    */
var $_ = function (options, str) {
    if (arguments.length !== 2 || typeof str !== "string") {
        return "<$_> must have exactly one child, which must be a string";}

    return interpolateStringToFragment(str, options);};


/**
    * A simple i18n react component-like function to allow for marking a
    * string as not needing to be translated.
    *
    * Example:
    *
    *    <$i18nDoNotTranslate>English only text.</$i18nDoNotTranslate>
    *
    * which react/jsx compiles to:
    *    $i18nDoNotTranslate(null, "English only text.")
    */
var $i18nDoNotTranslate = function (options, str) {
    return str;};


/**
    * Simple ngettext method with sprintf-like %(name)s replacement
    * To be used like so:
    *   i18n.ngettext("Singular", "Plural", 3)
    *   i18n.ngettext("1 Cat", "%(num)s Cats", 3)
    *   i18n.ngettext("1 %(type)s", "%(num)s %(type)s", 3, {type: "Cat"})
    * This method is also meant to be used when injecting for other
    * non-English languages, like so (taking an array of plural messages,
    * which varies based upon the language):
    *   i18n.ngettext({
    *     lang: "ja",
    *     messages: ["%(num)s 猫 %(username)s"]
    *   }, 3, {username: "John"});
    */
var ngettext = function (singular, plural, num, options) {
    // Fall back to the default lang
    var lang;
    var messages;

    // If the first argument is an object then we're receiving a plural
    // configuration object
    if (typeof singular === "object") {
        lang = singular.lang;
        messages = singular.messages;
        // We only have a messages object no plural string
        // thus we need to shift all the arguments over by one.
        options = num;
        num = plural;} else 
    {
        lang = "en"; // We're using text written into the source code
        messages = [singular, plural];}


    // Get the translated string
    var idx = ngetpos(num, lang);
    var translation = "";
    if (idx < messages.length) {// the common (non-error) case
        translation = messages[idx];}


    // Get the options to substitute into the string.
    // We automatically add in the 'magic' option-variable 'num'.
    options = options || {};
    options.num = options.num || num;

    // Then pass into i18n._ for the actual substitution
    return _(translation, options);};


/*
    * Return the ngettext position that matches the given number and locale.
    *
    * Arguments:
    *  - num: The number upon which to toggle the plural forms.
    *  - lang: The language to use as the basis for the pluralization.
    */
var ngetpos = function (num, lang) {
    var pluralForm = allPluralForms[lang] || allPluralForms["en"];
    var pos = pluralForm(num);
    // Map true to 1 and false to 0, keep any numeric return value the same.
    return pos === true ? 1 : pos ? pos : 0;};


/*
    * A dummy identity function.  It's used as a signal to automatic
    * translation-identification tools that they shouldn't mark this
    * text up to be translated, even though it looks like
    * natural-language text.  (And likewise, a signal to linters that
    * they shouldn't complain that this text isn't translated.)
    * Use it like so: 'tag.author = i18n.i18nDoNotTranslate("Jim");'
    */
var i18nDoNotTranslate = _;

/**
    * Dummy Handlebars _ function. Is a noop.
    * Should be used as: {{#_}}...{{/_}}
    * The text is extracted, at compile-time, by server-side scripts.
    * This is just used for marking up those fragments that need translation.
    * The translated text is injected at deploy-time.
    */
var handlebarsUnderscore = function (options) {
    return options.fn(this);};


/**
    *  Mark text as not needing translation.
    *
    * This function is used to let i18nize_templates.py know that
    * everything within it does not need to be translate.
    * Should be used as: {{#i18nDoNotTranslate}}...{{/i18nDoNotTranslate}}
    * It does not need to actually do anything and hence returns the contents
    * as is.
    */
var handlebarsDoNotTranslate = function (options) {
    return options.fn(this);};


/**
    * Handlebars ngettext function.
    * Doesn't do any translation, is used for showing the correct string
    * based upon the specified number and language.
    * All strings are extracted (at compile-time) and injected (at
    * deploy-time). By default this should be used as:
    *   {{#ngettext NUM}}singular{{else}}plural{{/ngettext}}
    * After injecting the translated strings into the page it'll read as:
    *   {{#ngettext NUM "lang" 0}}singular{{else}}plural{{/ngettext}}
    * (May depend upon the language used and how many different plural
    * forms the language has.)
    *
    * Arguments:
    *  - num: The number upon which to toggle the plural forms.
    *  - lang: The language to use as the basis for the pluralization.
    *  - pos: The expected plural form (depends upon the language)
    */
var handlebarsNgettext = function (num, lang, pos, options) {
    // This method has two signatures:
    // (num) (the default for when the code is run in dev mode)
    // (num, lang, pos) (for when the code is run in prod mode)
    if (typeof lang !== "string") {
        options = lang;
        lang = "en";
        pos = 0;}


    // Add in 'num' as a magic variable.
    this.num = this.num || num;

    // If the result of the plural form function given the specified
    // number matches the expected position then we give the first
    // result, otherwise we give the inverse result.
    return ngetpos(num) === pos ? 
    options.fn(this) : 
    options.inverse(this);};


/**
 * Rounds num to X places, and uses the proper decimal seperator.
 * But does *not* insert thousands separators.
 */
var localeToFixed = function (num, places) {
    var decimalSeperator = icu.getDecimalFormatSymbols().decimal_separator;
    var localeFixed = num.toFixed(places).replace(".", decimalSeperator);
    if (localeFixed === "-0") {
        localeFixed = "0";}

    return localeFixed;};


// This is necessary for khan-exercises, perseus, and
// bootstrap-daterangepicker (live-editor also uses the global i18n
// var, but defines its own version of it.)  We export the symbols
// that they need.
window.i18n = { 
    _: _, 
    ngettext: ngettext, 
    i18nDoNotTranslate: i18nDoNotTranslate, 
    // khan-exercises is the only client of ngetpos (which is emitted
    // into khan-exercises by kake/translate-exercises.py).
    ngetpos: ngetpos };


// TODO(csilvers): is it still necessary to make these globals?
window.$_ = $_;
window.$i18nDoNotTranslate = $i18nDoNotTranslate;

module.exports = { 
    // The main i18n API
    _: _, 
    ngettext: ngettext, 
    i18nDoNotTranslate: i18nDoNotTranslate, 
    // The main l10n API
    localeToFixed: localeToFixed, 
    // These are for react
    $_: $_, 
    $i18nDoNotTranslate: $i18nDoNotTranslate, 

    // This is used only by handlebars-extras.js
    handlebarsUnderscore: handlebarsUnderscore, 
    handlebarsNgettext: handlebarsNgettext, 
    handlebarsDoNotTranslate: handlebarsDoNotTranslate };
});
KAdefine("javascript/shared-package/a11y.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Automatically adjust markup to better suit people with disabilities.
 */
var $ = require("jquery");

var i18n = require("./i18n.js");
var KA = require("./ka.js");
var cookies = require("./cookies.js");
var parseQueryString = require("./parse-query-string.js");

module.exports = { 
    init: function () {
        this.externalLink();
        this.srOnlyInputFocus();

        // Load tota11y for devs who do not have a "enable_tota11y" cookie set
        // to "0"
        var tota11yFlag = parseQueryString()["tota11yk"];
        if (tota11yFlag) {
            cookies.createCookie("enable_tota11y", tota11yFlag);}


        if (KA.isDeveloper() && cookies.readCookie("enable_tota11y") !== "0") {
            require.async([
            "../../third_party/javascript-khansrc/tota11y/build/tota11y.min.js"]);}}, 




    // Make all external links (links with a _blank target that open in a new
    // window) also include some explanatory text that'll inform the user of
    // the nature of the link
    externalLink: function () {
        var selector = "a[target=_blank]:not(.external-link)";
        var newWindow = i18n._("(Opens in a new window)");

        $(document).on("focusin", selector, function () {
            $(this).
            addClass("external-link").
            attr("title", function (title) {
                return title ? title + " " + newWindow : "";}).

            append("<span class='sr-only'>" + newWindow + "</span>");});}, 



    // Make it so that if an input is ever focused, while inside of an
    // element with a class of sr-only (in that it should only be visible to
    // a screen reader) we make sure to show the element (otherwise it would
    // be confusing for a sighted reader that is focusing on an element that
    // they can't see!)
    srOnlyInputFocus: function () {
        $(document).on("focusin", ".sr-only input, .sr-only a", function () {
            $(this).closest(".sr-only").
            toggleClass("sr-only sr-only-visible");}).
        on("focusout", ".sr-only-visible input, .sr-only-visible a", 
        function () {
            $(this).closest(".sr-only-visible").
            toggleClass("sr-only sr-only-visible");});} };
});
KAdefine("javascript/shared-package/package-manager.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-console, no-undef, prefer-spread */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * PackageManager downloads and executes JavaScript and CSS files while
 * tracking which of them have already been downloaded and/or executed.
 *
 * It ensures that packages are executed only after all their dependencies have
 * been downloaded and executed.
 *
 * It is completely agnostic to the contents of those files and
 * simply knows how to execute them.
 *
 * Packages must be defined via PackageManager.registerDynamic or
 * PackageManager.registerManfiests before they can be required, but may be
 * marked executed before being defined.
 *
 * You define a package like this:
 *
 *     PackageManager.registerDynamic({
 *         name: "a.css",
 *         url: "/a-package/foo.css"
 *     });
 *
 * Or you can define many packages at once like this:
 *
 *     PackageManager.registerManifests({
 *         javascript: [{
 *             name: "a.js",
 *             url: "/a-pkg.js"
 *         }, {
 *             name: "b.js",
 *             url: "/b-pkg.js",
 *             dependencies: ["a.js"]
 *         }]
 *         stylesheets: [{
 *             name: "a.css",
 *             url: "/a-pkg.css"
 *         }]
 *     });
 *
 * To load files and execute something after they've been executed, usage
 * PackageManager.require like so:
 *
 *     PackageManager.require("a.js", "b.js").then(function() {
 *         // a.js, b.js, and all of their dependencies have been downloaded and
 *         // executed now.
 *     });
 *
 * To mark a package as already executed (should only happen from template tags
 * when packages are downloaded directly by the browser via <script> and <link>
 * tags, use PackageManager.markExecuted like so:
 *
 *     PackageManager.markExecuted("a.js", "b.js");
 */

var $ = require("jquery");
var _ = require("../../third_party/javascript-khansrc/lodash/lodash.js");

var KA = require("./ka.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;

var staticUrl = function (path) {
    // In IE9, we can't have this request change protocol.
    // TODO(csilvers): use window.location.protocol globally (in staticUrl())?
    return KA.staticUrl(path).replace(/^https?:/, window.location.protocol);};


var PACKAGE_STATE_DEFINED = 1;
var PACKAGE_STATE_LOADING = 2;
var PACKAGE_STATE_LOADED = 3;
var PACKAGE_STATE_EXECUTED = 4;

var PACKAGE_LEVEL_NOT_SET = -2;
var PACKAGE_LEVEL_CALCULATING = -1;

// @type {Object.<string, _Package>} Map from package name to _Package instance
var _packagesByName = {};

/**
 * A _Package represents the lifecycle of a single file being downloaded and
 * executed, tracking its dependencies along the way. This is an implementation
 * detail of PackageManager and should not be used outside of this file.
 */var 
_Package = (function () {
    /**
     * @param {string} name The name of the package, e.g. dashboard.js.
     * @param {string} urlPath The absolute path indicating where to download
     *     this file from.
     *     e.g. "/genfiles/javascript/en/dashboard-package-7348bd.js"
     * @param {string[]} dependencyNames A list of names of packages that
     *     this package depends on. e.g. ["corelibs.js", "shared.js"]
     */
    function _Package(name, urlPath, dependencyNames) {babelHelpers.classCallCheck(this, _Package);
        this._name = name;
        this._url = staticUrl(urlPath);
        this._dependencyNames = dependencyNames;

        this._content = null;
        this._state = PACKAGE_STATE_DEFINED;
        this._fetchingPromise = null;
        this._level = PACKAGE_LEVEL_NOT_SET;}


    /**
     * @return {_Package[]} A list of _Package instances which this package
     *     directly depends on, ordered arbitrarily.
     */_Package.prototype.
    _getDependencies = function _getDependencies() {
        return this._dependencyNames.map(function (depName) {return _Package.get(depName);});};


    /**
     * @returns {_Package[]} A list of _Package instances which this package
     *     transitively depends on, ordered arbitrarily. Note that this
     *     includes the current package.
     */_Package.prototype.
    _getTransitiveDependencies = function _getTransitiveDependencies() {
        var pkgByName = {};
        var frontier = [this];

        while (frontier.length > 0) {
            var cur = frontier.shift();
            if (pkgByName.hasOwnProperty(cur._name)) {
                continue;}

            pkgByName[cur._name] = cur;
            cur._getDependencies().forEach(function (pkg) {return frontier.push(pkg);});}


        return Object.values(pkgByName);};


    /**
     * @return number The level of a package indicates a topological sorting
     *   order. The dependencies of package A all have a lower level than A.
     *   Packages with no dependencies are assigned a level of 0. In the case of
     *   a cycle, the order the levels within the cycle is arbitrary, but all
     *   non-cyclical dependendencies are still ordered correctly.
     */_Package.prototype.
    _getLevel = function _getLevel() {
        if (this._level === PACKAGE_LEVEL_NOT_SET) {
            this._level = PACKAGE_LEVEL_CALCULATING;
            var depPkgs = this._getDependencies();
            if (depPkgs.length === 0) {
                this._level = 0;} else 
            {
                var depLevels = depPkgs.map(function (depPkg) {
                    return depPkg._getLevel();}).
                filter(function (level) {
                    // If one of our dependencies' levels is currently being
                    // calculated, then we must have a circular dependency. In
                    // this case we break the cycle by just ignoring that
                    // dependency completely.
                    return level !== PACKAGE_LEVEL_CALCULATING;});


                this._level = Math.max.apply(Math, depLevels) + 1;}}


        return this._level;};


    /**
     * Indicate that this package has already been executed.
     * This will also mark the fetching promise as resolved to prevent
     * re-fetching this package.
     */_Package.prototype.
    markExecuted = function markExecuted() {
        this._state = PACKAGE_STATE_EXECUTED;
        this._fetchingPromise = Promise.resolve();};


    /**
     * Begin downloading the package if it hasn't already started downloading or
     * marked executed. This function is idempotent.
     *
     * @return {Promise} A promise resolved once the package has been
     *     downloaded. If the package has already been downlaoded, the returned
     *     promise will be resolved.
     */_Package.prototype.
    _fetch = function _fetch() {var _this = this;
        if (this._state >= PACKAGE_STATE_LOADING) {
            return this._fetchingPromise;}


        this._fetchingPromise = new Promise(function (resolve) {
            // We delay sending off ajax requests to load async packages until
            // all the things required to render the initial page load are
            // done running.
            $(document).ready(function () {
                khanFetch(_this._url).
                then(function (resp) {return resp.text();}).
                then(function (data) {
                    _this._content = data;
                    _this._state = PACKAGE_STATE_LOADED;
                    resolve();});});});




        this._state = PACKAGE_STATE_LOADING;

        return this._fetchingPromise;};_Package.prototype.


    isExecuted = function isExecuted() {
        return this._state === PACKAGE_STATE_EXECUTED;};


    /**
     * Execute the current package. This does not ensure that dependencies have
     * already been executed.
     */_Package.prototype.
    _execute = function _execute() {
        if (this.isExecuted()) {
            return;}


        if (this._content === null) {
            var errorMsg = "_Package " + 
            name + " cannot be executed without content.";
            console.error(errorMsg);
            throw new Error(errorMsg);}


        var ext = this._name.slice(this._name.lastIndexOf(".") + 1);

        if (ext === "js") {
            this._executeJs();} else 
        if (ext === "css") {
            this._injectCss();} else 
        {
            throw new Error("Unknown package extension " + ext);}


        this._state = PACKAGE_STATE_EXECUTED;};


    /**
     * Fetch and execute this package and all its transitive dependencies.
     * Execution only begins once all transitive dependencies have been
     * downloaded.
     *
     * @return {Promise} A promise resolved once all transitive dependencies
     *     (including the current package) have been executed.
     */_Package.prototype.
    fetchAndExecute = function fetchAndExecute() {
        // Order the packages by their topological sorting order to make them
        // safe to execute in order.
        var transitiveDeps = this._getTransitiveDependencies().
        sort(function (a, b) {return a._getLevel() - b._getLevel();});

        return Promise.all(
        transitiveDeps.map(function (pkg) {return pkg._fetch();})).
        then(function () {
            transitiveDeps.forEach(function (pkg) {return pkg._execute();});});};



    /**
     * Execute the package contents as JavaScript.
     */_Package.prototype.
    _executeJs = function _executeJs() {
        var content = this._content;
        var url = this._url;
        $.globalEval("" + content + "\n//# sourceURL=" + url + "\n");};


    /**
     * Inject the package contents as CSS into the document head.
     */_Package.prototype.
    _injectCss = function _injectCss() {
        var head = document.getElementsByTagName("head")[0] || 
        document.documentElement;

        var styleElem = document.createElement("style");
        styleElem.setAttribute("data-href", this._url);
        styleElem.setAttribute("data-package-name", this._name);

        if (styleElem.styleSheet) {// IE
            styleElem.styleSheet.cssText = this._content;} else 
        {
            var node = document.createTextNode(this._content);
            styleElem.appendChild(node);}


        head.appendChild(styleElem);};


    /**
     * Get a _Package instance by name. _Package must be defined via
     * _Package.define before it can be retrieved via _Package.get.
     *
     * @param {string} packageName The name of the package, e.g. dashboard.js
     * @return {_Package} The _Package instance with the associated name.
     */_Package.
    get = function get(packageName) {
        var pkg = _packagesByName[packageName];

        if (!pkg) {
            throw new Error("Could not find package with name " + packageName);}


        return pkg;};


    /**
     * Define a package by name, url, and dependencies to allow it to be looked
     * up via _Package.get.
     *
     * @param {string} name The name of the package, e.g. dashboard.js.
     * @param {string} path The absolute path (path in the URL sense, not the
     *     file system sense) indicating where to download this file from.
     *     e.g. /genfiles/javascript/en/dashboard-package-7348bd.js
     * @param {string[]} dependencyNames A list of names of packages that
     *     the package depends on. e.g. ["corelibs.js", "shared.js"]
     */_Package.
    define = function define(packageName, url, dependencyNames) {
        if (!_Package.isDefined(packageName)) {
            _packagesByName[packageName] = new _Package(packageName, url, 
            dependencyNames);}};



    /**
     * @return {boolean} true if the package has been defined via
     *     _Package.define, false otherwise.
     */_Package.
    isDefined = function isDefined(packageName) {
        return _packagesByName.hasOwnProperty(packageName);};return _Package;})();



// Public API

window.PackageManager = window.PackageManager || {};

// Promise which resolves when manifests are registered for the first time.
PackageManager._manifestsRegistered = new Promise(function (resolve) {
    PackageManager._resolveManifestsRegistered = resolve;});


/**
 * Mark previously executed packages as executed.
 */
PackageManager.init = function () {
    // We define a stub of PackageManager to allow packages to mark themselves
    // as defined before loading this full version of PackageManager.
    //
    // See _ensure_package_registry_present in js_css_packages/templatetags.py
    if (PackageManager._q) {
        PackageManager.markExecuted.apply(PackageManager, PackageManager._q);
        delete PackageManager._q;}


    if (KA.IS_DEV_SERVER) {
        // In development, we want to surface which packages are being loaded at
        // various times to make people aware that they may be downloading far
        // more than they really need.
        $(document).ready(function () {
            var initialJsPackages = [];
            var initialCssPackages = [];

            for (var _iterator = Object.entries(_packagesByName), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {var _ref;if (_isArray) {if (_i >= _iterator.length) break;_ref = _iterator[_i++];} else {_i = _iterator.next();if (_i.done) break;_ref = _i.value;}var pkgName = _ref[0];var pkg = _ref[1]; // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
                if (pkg.isExecuted()) {
                    var ext = pkgName.split(".").pop();
                    if (ext === "js") {
                        initialJsPackages.push(pkgName);} else 
                    {
                        initialCssPackages.push(pkgName);}}}




            console.info("[PackageManager] %d initial JS package(s): %s", 
            initialJsPackages.length, initialJsPackages.join(", "));
            console.info("[PackageManager] %d initial CSS package(s): %s", 
            initialCssPackages.length, initialCssPackages.join(", "));});}};




var logDynamicRequire = (function () {
    var burst = [];
    var debouncedLog = _.debounce(function () {
        console.info("[PackageManager] dynamically loading %d package(s): %s", 
        burst.length, 
        burst.join(", "));
        burst = [];}, 
    100);

    return function (pkgName) {
        burst.push(pkgName);
        debouncedLog();};})();



/**
 * Download and execute packages by name.
 *
 * @param {...string} packageNames List of package names
 * @return {Promise} A promise resolved after all requested packages have been
 *   executed.
 */
PackageManager.require = function () {for (var _len = arguments.length, packageNames = Array(_len), _key = 0; _key < _len; _key++) {packageNames[_key] = arguments[_key];}
    return Promise.all(packageNames.map(function (name) {
        if (KA.IS_DEV_SERVER) {
            logDynamicRequire(name);}


        // We allow you to do a PackageManager.require() call before the
        // manifests are registered. If packages are registered, but the package
        // *still* isn't defined, _Package.get(name) will console log an error
        // and produce an error via `.catch()`.
        if (_Package.isDefined(name)) {
            return _Package.get(name).fetchAndExecute();} else 
        {
            return PackageManager._manifestsRegistered.then(function () {
                return _Package.get(name).fetchAndExecute();});}}));};





// @type {Object.<string, boolean>} A set (the value is always true if set at
//   all) of packages that have already been executed. We store this externally
//   from _Package instances because packages may be marked executed before
//   a package has been fully defined. See documentation of registerDynamic for
//   more information.
var toBeMarkedExecuted = {};

/**
 * Mark packages as already executed.
 *
 * @param {...string} packageNames List of package names
 */
PackageManager.markExecuted = function () {for (var _len2 = arguments.length, packageNames = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {packageNames[_key2] = arguments[_key2];}
    packageNames.forEach(function (name) {
        if (_Package.isDefined(name)) {
            _Package.get(name).markExecuted();} else 
        {
            toBeMarkedExecuted[name] = true;}});};




/**
 * Define a single package.
 *
 * @param {Object} options Configuration for the package.
 * @param {string} options.name Name of the package, e.g. dashboard.js
 * @param {string} options.url Absolute url path indicating where to download
 *     the package contents.
 *     e.g. ["/genfiles/javascript/en/dashboard-package-7348bd.js"]
 * @param {string[]?} options.dependencies List of package names this package
 *     depends on. If omitted, defaults to the empty list.
 *     e.g. ["corelibs.js", "shared.js"]
 */
PackageManager.registerDynamic = function (options) {
    var name = options.name;
    var urlPath = options.url;
    var dependencyNames = options.dependencies || [];
    _Package.define(name, urlPath, dependencyNames);

    // If the package was marked as executed before being defined, mark the
    // package instance as executed now.
    if (toBeMarkedExecuted[name]) {
        _Package.get(name).markExecuted();
        delete toBeMarkedExecuted[name];}};



/**
 * Define many packages at once.
 *
 * @param {Object} manifests The manifest for many packages in the system.
 * @param {Object[]} manifests.javascript A list of package configuration
 *     options for JavaScript packages to be passed to registerDynamic.
 * @param {Object[]} manifests.stylesheets A list of package configuration
 *     options for CSS packages to be passed to registerDynamic.
 */
PackageManager.registerManifests = function (manifests) {
    (manifests["javascript"] || []).forEach(PackageManager.registerDynamic);
    (manifests["stylesheets"] || []).forEach(PackageManager.registerDynamic);
    PackageManager._resolveManifestsRegistered();};


module.exports = PackageManager;
});
KAdefine("third_party/javascript-khansrc/jqueryui/jquery.ui.touch-punch.js", function(__KA_require, __KA_module, __KA_exports) {
__KA_require("../../../javascript/node_modules/jquery/index.js");
__KA_require("./jquery.ui.mouse.js");
/*!
 * jQuery UI Touch Punch 0.2.2
 *
 * Copyright 2011, Dave Furfero
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Depends:
 *  jquery.ui.widget.js
 *  jquery.ui.mouse.js
 */
(function ($) {

  // Detect touch support
  $.support.touch = 'ontouchend' in document;

  // Ignore browsers without touch support
  if (!$.support.touch) {
    return;
  }

  var mouseProto = $.ui.mouse.prototype,
      _mouseInit = mouseProto._mouseInit,
      touchHandled;

  /**
   * Simulate a mouse event based on a corresponding touch event
   * @param {Object} event A touch event
   * @param {String} simulatedType The corresponding mouse event
   */
  function simulateMouseEvent (event, simulatedType) {

    // Ignore multi-touch events
    if (event.originalEvent.touches.length > 1) {
      return;
    }

    event.preventDefault();

    var touch = event.originalEvent.changedTouches[0],
        simulatedEvent = document.createEvent('MouseEvents');
    
    // Initialize the simulated mouse event using the touch event's coordinates
    simulatedEvent.initMouseEvent(
      simulatedType,    // type
      true,             // bubbles                    
      true,             // cancelable                 
      window,           // view                       
      1,                // detail                     
      touch.screenX,    // screenX                    
      touch.screenY,    // screenY                    
      touch.clientX,    // clientX                    
      touch.clientY,    // clientY                    
      false,            // ctrlKey                    
      false,            // altKey                     
      false,            // shiftKey                   
      false,            // metaKey                    
      0,                // button                     
      null              // relatedTarget              
    );

    // Dispatch the simulated event to the target element
    event.target.dispatchEvent(simulatedEvent);
  }

  /**
   * Handle the jQuery UI widget's touchstart events
   * @param {Object} event The widget element's touchstart event
   */
  mouseProto._touchStart = function (event) {

    var self = this;

    // Ignore the event if another widget is already being handled
    if (touchHandled || !self._mouseCapture(event.originalEvent.changedTouches[0])) {
      return;
    }

    // Set the flag to prevent other widgets from inheriting the touch event
    touchHandled = true;

    // Track movement to determine if interaction was a click
    self._touchMoved = false;

    // Simulate the mouseover event
    simulateMouseEvent(event, 'mouseover');

    // Simulate the mousemove event
    simulateMouseEvent(event, 'mousemove');

    // Simulate the mousedown event
    simulateMouseEvent(event, 'mousedown');
  };

  /**
   * Handle the jQuery UI widget's touchmove events
   * @param {Object} event The document's touchmove event
   */
  mouseProto._touchMove = function (event) {

    // Ignore event if not handled
    if (!touchHandled) {
      return;
    }

    // Interaction was not a click
    this._touchMoved = true;

    // Simulate the mousemove event
    simulateMouseEvent(event, 'mousemove');
  };

  /**
   * Handle the jQuery UI widget's touchend events
   * @param {Object} event The document's touchend event
   */
  mouseProto._touchEnd = function (event) {

    // Ignore event if not handled
    if (!touchHandled) {
      return;
    }

    // Simulate the mouseup event
    simulateMouseEvent(event, 'mouseup');

    // Simulate the mouseout event
    simulateMouseEvent(event, 'mouseout');

    // If the touch interaction did not move, it should trigger a click
    if (!this._touchMoved) {

      // Simulate the click event
      simulateMouseEvent(event, 'click');
    }

    // Unset the flag to allow other widgets to inherit the touch event
    touchHandled = false;
  };

  /**
   * A duck punch of the $.ui.mouse _mouseInit method to support touch events.
   * This method extends the widget with bound touch event handlers that
   * translate touch events to mouse events and pass them to the widget's
   * original mouse event handling methods.
   */
  mouseProto._mouseInit = function () {
    
    var self = this;

    // Delegate the touch handlers to the widget's element
    self.element
      .bind('touchstart', $.proxy(self, '_touchStart'))
      .bind('touchmove', $.proxy(self, '_touchMove'))
      .bind('touchend', $.proxy(self, '_touchEnd'));

    // Call the original $.ui.mouse init method
    _mouseInit.call(self);
  };

})(jQuery);
});
KAdefine("third_party/javascript-khansrc/classnames/index.js", function(require, module, exports) {
function classNames() {
	var args = arguments;
	var classes = [];

	for (var i = 0; i < args.length; i++) {
		var arg = args[i];
		if (!arg) {
			continue;
		}

		if ('string' === typeof arg || 'number' === typeof arg) {
			classes.push(arg);
		} else if ('object' === typeof arg) {
			for (var key in arg) {
				if (arg.hasOwnProperty(key) && arg[key]) {
					classes.push(key);
				}
			}
		}
	}
	return classes.join(' ');
}

// safely export classNames in case the script is included directly on a page
if (typeof module !== 'undefined' && module.exports) {
	module.exports = classNames;
}
});
KAdefine("third_party/javascript-khansrc/aphrodite/dist/aphrodite.js", function(require, module, exports) {
module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = __webpack_require__(1);


/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	    value: true
	});

	var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

	var _util = __webpack_require__(2);

	var _inject = __webpack_require__(3);

	var StyleSheet = {
	    create: function create(sheetDefinition) {
	        return (0, _util.mapObj)(sheetDefinition, function (_ref) {
	            var _ref2 = _slicedToArray(_ref, 2);

	            var key = _ref2[0];
	            var val = _ref2[1];

	            return [key, {
	                // TODO(emily): Make a 'production' mode which doesn't prepend
	                // the class name here, to make the generated CSS smaller.
	                _name: key + '_' + (0, _util.hashObject)(val),
	                _definition: val
	            }];
	        });
	    },

	    renderBuffered: function renderBuffered(renderFunc) {
	        var renderedClassNames = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

	        (0, _inject.addRenderedClassNames)(renderedClassNames);
	        (0, _inject.startBuffering)(false);
	        renderFunc(_inject.flushToStyleTag);
	    }
	};

	var StyleSheetServer = {
	    renderStatic: function renderStatic(renderFunc) {
	        (0, _inject.reset)();
	        (0, _inject.startBuffering)(true);
	        var html = renderFunc();
	        var cssContent = (0, _inject.flushToString)();

	        return {
	            html: html,
	            css: {
	                content: cssContent,
	                renderedClassNames: (0, _inject.getRenderedClassNames)()
	            }
	        };
	    }
	};

	var css = function css() {
	    for (var _len = arguments.length, styleDefinitions = Array(_len), _key = 0; _key < _len; _key++) {
	        styleDefinitions[_key] = arguments[_key];
	    }

	    // Filter out falsy values from the input, to allow for
	    // `css(a, test && c)`
	    var validDefinitions = styleDefinitions.filter(function (def) {
	        return def;
	    });

	    // Break if there aren't any valid styles.
	    if (validDefinitions.length === 0) {
	        return "";
	    }

	    var className = validDefinitions.map(function (s) {
	        return s._name;
	    }).join("-o_O-");
	    (0, _inject.injectStyleOnce)(className, '.' + className, validDefinitions.map(function (d) {
	        return d._definition;
	    }));

	    return className;
	};

	exports['default'] = {
	    StyleSheet: StyleSheet,
	    StyleSheetServer: StyleSheetServer,
	    css: css
	};
	module.exports = exports['default'];

/***/ },
/* 2 */
/***/ function(module, exports) {

	// {K1: V1, K2: V2, ...} -> [[K1, V1], [K2, V2]]
	'use strict';

	Object.defineProperty(exports, '__esModule', {
	    value: true
	});

	var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

	var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

	var objectToPairs = function objectToPairs(obj) {
	    return Object.keys(obj).map(function (key) {
	        return [key, obj[key]];
	    });
	};

	exports.objectToPairs = objectToPairs;
	// [[K1, V1], [K2, V2]] -> {K1: V1, K2: V2, ...}
	var pairsToObject = function pairsToObject(pairs) {
	    var result = {};
	    pairs.forEach(function (_ref) {
	        var _ref2 = _slicedToArray(_ref, 2);

	        var key = _ref2[0];
	        var val = _ref2[1];

	        result[key] = val;
	    });
	    return result;
	};

	var mapObj = function mapObj(obj, fn) {
	    return pairsToObject(objectToPairs(obj).map(fn));
	};

	exports.mapObj = mapObj;
	var UPPERCASE_RE = /([A-Z])/g;
	var MS_RE = /^ms-/;

	var kebabify = function kebabify(string) {
	    return string.replace(UPPERCASE_RE, '-$1').toLowerCase();
	};
	var kebabifyStyleName = function kebabifyStyleName(string) {
	    return kebabify(string).replace(MS_RE, '-ms-');
	};

	exports.kebabifyStyleName = kebabifyStyleName;
	var recursiveMerge = function recursiveMerge(a, b) {
	    // TODO(jlfwong): Handle malformed input where a and b are not the same
	    // type.

	    if (typeof a !== 'object') {
	        return b;
	    }

	    var ret = _extends({}, a);

	    Object.keys(b).forEach(function (key) {
	        if (ret.hasOwnProperty(key)) {
	            ret[key] = recursiveMerge(a[key], b[key]);
	        } else {
	            ret[key] = b[key];
	        }
	    });

	    return ret;
	};

	exports.recursiveMerge = recursiveMerge;
	/**
	 * CSS properties which accept numbers but are not in units of "px".
	 * Taken from React's CSSProperty.js
	 */
	var isUnitlessNumber = {
	    animationIterationCount: true,
	    boxFlex: true,
	    boxFlexGroup: true,
	    boxOrdinalGroup: true,
	    columnCount: true,
	    flex: true,
	    flexGrow: true,
	    flexPositive: true,
	    flexShrink: true,
	    flexNegative: true,
	    flexOrder: true,
	    gridRow: true,
	    gridColumn: true,
	    fontWeight: true,
	    lineClamp: true,
	    lineHeight: true,
	    opacity: true,
	    order: true,
	    orphans: true,
	    tabSize: true,
	    widows: true,
	    zIndex: true,
	    zoom: true,

	    // SVG-related properties
	    fillOpacity: true,
	    stopOpacity: true,
	    strokeDashoffset: true,
	    strokeOpacity: true,
	    strokeWidth: true
	};

	/**
	 * Taken from React's CSSProperty.js
	 *
	 * @param {string} prefix vendor-specific prefix, eg: Webkit
	 * @param {string} key style name, eg: transitionDuration
	 * @return {string} style name prefixed with `prefix`, properly camelCased, eg:
	 * WebkitTransitionDuration
	 */
	function prefixKey(prefix, key) {
	    return prefix + key.charAt(0).toUpperCase() + key.substring(1);
	}

	/**
	 * Support style names that may come passed in prefixed by adding permutations
	 * of vendor prefixes.
	 * Taken from React's CSSProperty.js
	 */
	var prefixes = ['Webkit', 'ms', 'Moz', 'O'];

	// Using Object.keys here, or else the vanilla for-in loop makes IE8 go into an
	// infinite loop, because it iterates over the newly added props too.
	// Taken from React's CSSProperty.js
	Object.keys(isUnitlessNumber).forEach(function (prop) {
	    prefixes.forEach(function (prefix) {
	        isUnitlessNumber[prefixKey(prefix, prop)] = isUnitlessNumber[prop];
	    });
	});

	var stringifyValue = function stringifyValue(key, prop, stringHandlers) {
	    // If a handler exists for this particular key, let it interpret
	    // that value first before continuing
	    if (stringHandlers && stringHandlers.hasOwnProperty(key)) {
	        prop = stringHandlers[key](prop);
	    }

	    if (typeof prop === "number") {
	        if (isUnitlessNumber[key]) {
	            return "" + prop;
	        } else {
	            return prop + "px";
	        }
	    } else {
	        return prop;
	    }
	};

	exports.stringifyValue = stringifyValue;
	/**
	 * JS Implementation of MurmurHash2
	 *
	 * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
	 * @see http://github.com/garycourt/murmurhash-js
	 * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
	 * @see http://sites.google.com/site/murmurhash/
	 *
	 * @param {string} str ASCII only
	 * @return {string} Base 36 encoded hash result
	 */
	function murmurhash2_32_gc(str) {
	    var l = str.length;
	    var h = l;
	    var i = 0;
	    var k = undefined;

	    while (l >= 4) {
	        k = str.charCodeAt(i) & 0xff | (str.charCodeAt(++i) & 0xff) << 8 | (str.charCodeAt(++i) & 0xff) << 16 | (str.charCodeAt(++i) & 0xff) << 24;

	        k = (k & 0xffff) * 0x5bd1e995 + (((k >>> 16) * 0x5bd1e995 & 0xffff) << 16);
	        k ^= k >>> 24;
	        k = (k & 0xffff) * 0x5bd1e995 + (((k >>> 16) * 0x5bd1e995 & 0xffff) << 16);

	        h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0x5bd1e995 & 0xffff) << 16) ^ k;

	        l -= 4;
	        ++i;
	    }

	    switch (l) {
	        case 3:
	            h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
	        case 2:
	            h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
	        case 1:
	            h ^= str.charCodeAt(i) & 0xff;
	            h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0x5bd1e995 & 0xffff) << 16);
	    }

	    h ^= h >>> 13;
	    h = (h & 0xffff) * 0x5bd1e995 + (((h >>> 16) * 0x5bd1e995 & 0xffff) << 16);
	    h ^= h >>> 15;

	    return (h >>> 0).toString(36);
	}

	// Hash a javascript object using JSON.stringify. This is very fast, about 3
	// microseconds on my computer for a sample object:
	// http://jsperf.com/test-hashfnv32a-hash/5
	//
	// Note that this uses JSON.stringify to stringify the objects so in order for
	// this to produce consistent hashes browsers need to have a consistent
	// ordering of objects. Ben Alpert says that Facebook depends on this, so we
	// can probably depend on this too.
	var hashObject = function hashObject(object) {
	    return murmurhash2_32_gc(JSON.stringify(object));
	};
	exports.hashObject = hashObject;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	    value: true
	});

	var _generate = __webpack_require__(4);

	var injectStyleTag = function injectStyleTag(cssContents) {
	    // Taken from
	    // http://stackoverflow.com/questions/524696/how-to-create-a-style-tag-with-javascript
	    var head = document.head || document.getElementsByTagName('head')[0];
	    var style = document.createElement('style');

	    style.type = 'text/css';
	    if (style.styleSheet) {
	        style.styleSheet.cssText = cssContents;
	    } else {
	        style.appendChild(document.createTextNode(cssContents));
	    }

	    head.appendChild(style);
	};

	// Custom handlers for stringifying CSS values that have side effects
	// (such as fontFamily, which can cause @font-face rules to be injected)
	var stringHandlers = {
	    // With fontFamily we look for objects that are passed in and interpret
	    // them as @font-face rules that we need to inject. The value of fontFamily
	    // can either be a string (as normal), an object (a single font face), or
	    // an array of objects and strings.
	    fontFamily: function fontFamily(val) {
	        if (Array.isArray(val)) {
	            return val.map(fontFamily).join(",");
	        } else if (typeof val === "object") {
	            injectStyleOnce(val.fontFamily, "@font-face", [val], false);
	            return '"' + val.fontFamily + '"';
	        } else {
	            return val;
	        }
	    }
	};

	// This is a map from Aphrodite's generated class names to `true` (acting as a
	// set of class names)
	var alreadyInjected = {};

	// This is the buffer of styles which have not yet been flushed.
	var injectionBuffer = "";

	// We allow for concurrent calls to `renderBuffered`, this keeps track of which
	// level of nesting we are currently at. 0 means no buffering, >0 means
	// buffering.
	var bufferLevel = 0;

	// This tells us whether our previous request to buffer styles is from
	// renderStatic or renderBuffered. We don't want to allow mixing of the two, so
	// we keep track of which one we were in before. This only has meaning if
	// bufferLevel > 0.
	var inStaticBuffer = true;

	var injectStyleOnce = function injectStyleOnce(key, selector, definitions, useImportant) {
	    if (!alreadyInjected[key]) {
	        var generated = (0, _generate.generateCSS)(selector, definitions, stringHandlers, useImportant);
	        if (bufferLevel > 0) {
	            injectionBuffer += generated;
	        } else {
	            injectStyleTag(generated);
	        }
	        alreadyInjected[key] = true;
	    }
	};

	exports.injectStyleOnce = injectStyleOnce;
	var reset = function reset() {
	    injectionBuffer = "";
	    alreadyInjected = {};
	    bufferLevel = 0;
	    inStaticBuffer = true;
	};

	exports.reset = reset;
	var startBuffering = function startBuffering(isStatic) {
	    if (bufferLevel > 0 && inStaticBuffer !== isStatic) {
	        throw new Error("Can't interleave server-side and client-side buffering.");
	    }
	    inStaticBuffer = isStatic;
	    bufferLevel++;
	};

	exports.startBuffering = startBuffering;
	var flushToString = function flushToString() {
	    bufferLevel--;
	    if (bufferLevel > 0) {
	        return "";
	    } else if (bufferLevel < 0) {
	        throw new Error("Aphrodite tried to flush styles more often than it tried to " + "buffer them. Something is wrong!");
	    }

	    var ret = injectionBuffer;
	    injectionBuffer = "";
	    return ret;
	};

	exports.flushToString = flushToString;
	var flushToStyleTag = function flushToStyleTag() {
	    var cssContent = flushToString();
	    if (cssContent.length > 0) {
	        injectStyleTag(cssContent);
	    }
	};

	exports.flushToStyleTag = flushToStyleTag;
	var getRenderedClassNames = function getRenderedClassNames() {
	    return Object.keys(alreadyInjected);
	};

	exports.getRenderedClassNames = getRenderedClassNames;
	var addRenderedClassNames = function addRenderedClassNames(classNames) {
	    classNames.forEach(function (className) {
	        alreadyInjected[className] = true;
	    });
	};
	exports.addRenderedClassNames = addRenderedClassNames;

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	Object.defineProperty(exports, '__esModule', {
	    value: true
	});

	var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

	var _util = __webpack_require__(2);

	var generateCSS = function generateCSS(selector, styleTypes, stringHandlers, useImportant) {
	    var merged = styleTypes.reduce(_util.recursiveMerge);

	    var declarations = {};
	    var mediaQueries = {};
	    var pseudoStyles = {};

	    Object.keys(merged).forEach(function (key) {
	        if (key[0] === ':') {
	            pseudoStyles[key] = merged[key];
	        } else if (key[0] === '@') {
	            mediaQueries[key] = merged[key];
	        } else {
	            declarations[key] = merged[key];
	        }
	    });

	    return generateCSSRuleset(selector, declarations, stringHandlers, useImportant) + Object.keys(pseudoStyles).map(function (pseudoSelector) {
	        return generateCSSRuleset(selector + pseudoSelector, pseudoStyles[pseudoSelector], stringHandlers, useImportant);
	    }).join("") + Object.keys(mediaQueries).map(function (mediaQuery) {
	        var ruleset = generateCSS(selector, [mediaQueries[mediaQuery]], stringHandlers, useImportant);
	        return mediaQuery + '{' + ruleset + '}';
	    }).join("");
	};

	exports.generateCSS = generateCSS;
	var generateCSSRuleset = function generateCSSRuleset(selector, declarations, stringHandlers, useImportant) {
	    var rules = (0, _util.objectToPairs)(declarations).map(function (_ref) {
	        var _ref2 = _slicedToArray(_ref, 2);

	        var key = _ref2[0];
	        var value = _ref2[1];

	        var stringValue = (0, _util.stringifyValue)(key, value, stringHandlers);
	        var important = useImportant === false ? "" : " !important";
	        return (0, _util.kebabifyStyleName)(key) + ':' + stringValue + important + ';';
	    }).join("");

	    if (rules) {
	        return selector + '{' + rules + '}';
	    } else {
	        return "";
	    }
	};
	exports.generateCSSRuleset = generateCSSRuleset;

/***/ }
/******/ ]);
});
KAdefine("javascript/node_modules/aphrodite/index.js", function(require, module, exports) {
module.exports = require("../../../third_party/javascript-khansrc/aphrodite/dist/aphrodite.js");
});
KAdefine("third_party/javascript-khansrc/jquery-timeago/jquery.timeago.js", function(__KA_require, __KA_module, __KA_exports) {
__KA_require("../../../javascript/node_modules/jquery/index.js");
/**
 * Timeago is a jQuery plugin that makes it easy to support automatically
 * updating fuzzy timestamps (e.g. "4 minutes ago" or "about 1 day ago").
 *
 * @name timeago
 * @version 1.4.0
 * @requires jQuery v1.2.3+
 * @author Ryan McGeary
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://timeago.yarp.com/
 *
 * Copyright (c) 2008-2013, Ryan McGeary (ryan -[at]- mcgeary [*dot*] org)
 */

(function (factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define(['jquery'], factory);
  } else {
    // Browser globals
    factory(jQuery);
  }
}(function ($) {
  $.timeago = function(timestamp) {
    if (timestamp instanceof Date) {
      return inWords(timestamp);
    } else if (typeof timestamp === "string") {
      return inWords($.timeago.parse(timestamp));
    } else if (typeof timestamp === "number") {
      return inWords(new Date(timestamp));
    } else {
      return inWords($.timeago.datetime(timestamp));
    }
  };
  var $t = $.timeago;

  $.extend($.timeago, {
    settings: {
      refreshMillis: 60000,
      allowPast: true,
      allowFuture: false,
      localeTitle: false,
      cutoff: 0,
      strings: {
        prefixAgo: null,
        prefixFromNow: null,
        suffixAgo: "ago",
        suffixFromNow: "from now",
        inPast: 'any moment now',
        seconds: "less than a minute",
        minute: "about a minute",
        minutes: "%d minutes",
        hour: "about an hour",
        hours: "about %d hours",
        day: "a day",
        days: "%d days",
        month: "about a month",
        months: "%d months",
        year: "about a year",
        years: "%d years",
        wordSeparator: " ",
        numbers: []
      }
    },

    inWords: function(distanceMillis) {
      if(!this.settings.allowPast && ! this.settings.allowFuture) {
          throw 'timeago allowPast and allowFuture settings can not both be set to false.';
      }

      var $l = this.settings.strings;
      var prefix = $l.prefixAgo;
      var suffix = $l.suffixAgo;
      if (this.settings.allowFuture) {
        if (distanceMillis < 0) {
          prefix = $l.prefixFromNow;
          suffix = $l.suffixFromNow;
        }
      }

      if(!this.settings.allowPast && distanceMillis >= 0) {
        return this.settings.strings.inPast;
      }

      var seconds = Math.abs(distanceMillis) / 1000;
      var minutes = seconds / 60;
      var hours = minutes / 60;
      var days = hours / 24;
      var years = days / 365;

      function substitute(stringOrFunction, number) {
        var string = $.isFunction(stringOrFunction) ? stringOrFunction(number, distanceMillis) : stringOrFunction;
        var value = ($l.numbers && $l.numbers[number]) || number;
        return string.replace(/%d/i, value);
      }

      var words = seconds < 45 && substitute($l.seconds, Math.round(seconds)) ||
        seconds < 90 && substitute($l.minute, 1) ||
        minutes < 45 && substitute($l.minutes, Math.round(minutes)) ||
        minutes < 90 && substitute($l.hour, 1) ||
        hours < 24 && substitute($l.hours, Math.round(hours)) ||
        hours < 42 && substitute($l.day, 1) ||
        days < 30 && substitute($l.days, Math.round(days)) ||
        days < 45 && substitute($l.month, 1) ||
        days < 365 && substitute($l.months, Math.round(days / 30)) ||
        years < 1.5 && substitute($l.year, 1) ||
        substitute($l.years, Math.round(years));

      var separator = $l.wordSeparator || "";
      if ($l.wordSeparator === undefined) { separator = " "; }
      return $.trim([prefix, words, suffix].join(separator));
    },

    parse: function(iso8601) {
      var s = $.trim(iso8601);
      s = s.replace(/\.\d+/,""); // remove milliseconds
      s = s.replace(/-/,"/").replace(/-/,"/");
      s = s.replace(/T/," ").replace(/Z/," UTC");
      s = s.replace(/([\+\-]\d\d)\:?(\d\d)/," $1$2"); // -04:00 -> -0400
      s = s.replace(/([\+\-]\d\d)$/," $100"); // +09 -> +0900
      return new Date(s);
    },
    datetime: function(elem) {
      var iso8601 = $t.isTime(elem) ? $(elem).attr("datetime") : $(elem).attr("title");
      return $t.parse(iso8601);
    },
    isTime: function(elem) {
      // jQuery's `is()` doesn't play well with HTML5 in IE
      return $(elem).get(0).tagName.toLowerCase() === "time"; // $(elem).is("time");
    }
  });

  // functions that can be called via $(el).timeago('action')
  // init is default when no action is given
  // functions are called with context of a single element
  var functions = {
    init: function(){
      var refresh_el = $.proxy(refresh, this);
      refresh_el();
      var $s = $t.settings;
      if ($s.refreshMillis > 0) {
        this._timeagoInterval = setInterval(refresh_el, $s.refreshMillis);
      }
    },
    update: function(time){
      var parsedTime = $t.parse(time);
      $(this).data('timeago', { datetime: parsedTime });
      if($t.settings.localeTitle) $(this).attr("title", parsedTime.toLocaleString());
      refresh.apply(this);
    },
    updateFromDOM: function(){
      $(this).data('timeago', { datetime: $t.parse( $t.isTime(this) ? $(this).attr("datetime") : $(this).attr("title") ) });
      refresh.apply(this);
    },
    dispose: function () {
      if (this._timeagoInterval) {
        window.clearInterval(this._timeagoInterval);
        this._timeagoInterval = null;
      }
    }
  };

  $.fn.timeago = function(action, options) {
    var fn = action ? functions[action] : functions.init;
    if(!fn){
      throw new Error("Unknown function name '"+ action +"' for timeago");
    }
    // each over objects here and call the requested function
    this.each(function(){
      fn.call(this, options);
    });
    return this;
  };

  function refresh() {
    var data = prepareData(this);
    var $s = $t.settings;

    if (!isNaN(data.datetime)) {
      if ( $s.cutoff == 0 || distance(data.datetime) < $s.cutoff) {
        $(this).text(inWords(data.datetime));
      }
    }
    return this;
  }

  function prepareData(element) {
    element = $(element);
    if (!element.data("timeago")) {
      element.data("timeago", { datetime: $t.datetime(element) });
      var text = $.trim(element.text());
      if ($t.settings.localeTitle) {
        element.attr("title", element.data('timeago').datetime.toLocaleString());
      } else if (text.length > 0 && !($t.isTime(element) && element.attr("title"))) {
        element.attr("title", text);
      }
    }
    return element.data("timeago");
  }

  function inWords(date) {
    return $t.inWords(distance(date));
  }

  function distance(date) {
    return (new Date().getTime() - date.getTime());
  }

  // fix for IE6 suckage
  document.createElement("abbr");
  document.createElement("time");
}));
__KA_require("./locales/jquery.timeago.en.js");
});
KAdefine("third_party/javascript-khansrc/jquery-timeago/locales/jquery.timeago.en.js", function(__KA_require, __KA_module, __KA_exports) {
__KA_require("../../../../javascript/node_modules/jquery/index.js");
__KA_require("../jquery.timeago.js");
// English (Template)
jQuery.timeago.settings.strings = {
  prefixAgo: null,
  prefixFromNow: null,
  suffixAgo: "ago",
  suffixFromNow: "from now",
  seconds: "less than a minute",
  minute: "about a minute",
  minutes: "%d minutes",
  hour: "about an hour",
  hours: "about %d hours",
  day: "a day",
  days: "%d days",
  month: "about a month",
  months: "%d months",
  year: "about a year",
  years: "%d years",
  wordSeparator: " ",
  numbers: []
};
});
KAdefine("third_party/javascript-khansrc/bootstrap-khansrc/js/bootstrap-transition.js", function(__KA_require, __KA_module, __KA_exports) {
__KA_require("../../../../javascript/node_modules/jquery/index.js");
/* ===================================================
 * bootstrap-transition.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#transitions
 * ===================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================== */


!function ($) {

  "use strict"; // jshint ;_;


  /* CSS TRANSITION SUPPORT (http://www.modernizr.com/)
   * ======================================================= */

  $(function () {

    $.support.transition = (function () {

      var transitionEnd = (function () {

        var el = document.createElement('bootstrap')
          , transEndEventNames = {
               'WebkitTransition' : 'webkitTransitionEnd'
            ,  'MozTransition'    : 'transitionend'
            ,  'OTransition'      : 'oTransitionEnd otransitionend'
            ,  'transition'       : 'transitionend'
            }
          , name

        for (name in transEndEventNames){
          if (el.style[name] !== undefined) {
            return transEndEventNames[name]
          }
        }

      }())

      return transitionEnd && {
        end: transitionEnd
      }

    })()

  })

}(window.jQuery);
});
KAdefine("third_party/javascript-khansrc/bootstrap-khansrc/js/bootstrap-modal.js", function(__KA_require, __KA_module, __KA_exports) {
__KA_require("../../../../javascript/node_modules/jquery/index.js");
__KA_require("./bootstrap-transition.js");
/* =========================================================
 * bootstrap-modal.js v2.3.2
 * http://getbootstrap.com/2.3.2/javascript.html#modals
 * =========================================================
 * Copyright 2013 Twitter, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */


!function ($) {

  "use strict"; // jshint ;_;


 /* MODAL CLASS DEFINITION
  * ====================== */

  var Modal = function (element, options) {
    this.options = options
    this.$element = $(element)
      .delegate('[data-dismiss="modal"]', 'click.dismiss.modal', $.proxy(this.hide, this))
    this.options.remote && this.$element.find('.modal-body').load(this.options.remote)
  }

  Modal.prototype = {

      constructor: Modal

    , toggle: function () {
        return this[!this.isShown ? 'show' : 'hide']()
      }

    , show: function () {
        var that = this
          , e = $.Event('show')

        this.$element.trigger(e)

        if (this.isShown || e.isDefaultPrevented()) return

        this.isShown = true

        this.escape()

        this.backdrop(function () {
          var transition = $.support.transition && that.$element.hasClass('fade')

          if (!that.$element.parent().length) {
            that.$element.appendTo(document.body) //don't move modals dom position
          }

          that.$element.show()

          if (transition) {
            that.$element[0].offsetWidth // force reflow
          }

          that.$element
            .addClass('bootstrap-modal')
            .addClass('in')
            .attr('aria-hidden', false)

          that.enforceFocus()

          transition ?
            that.$element.one($.support.transition.end, function () { that.$element.focus().trigger('shown') }) :
            that.$element.focus().trigger('shown')

        })
      }

    , hide: function (e) {
        e && e.preventDefault()

        var that = this

        e = $.Event('hide')

        this.$element.trigger(e)

        if (!this.isShown || e.isDefaultPrevented()) return

        this.isShown = false

        this.escape()

        $(document).off('focusin.modal')

        this.$element
          .removeClass('in')
          .removeClass('bootstrap-modal')
          .attr('aria-hidden', true)

        $.support.transition && this.$element.hasClass('fade') ?
          this.hideWithTransition() :
          this.hideModal()
      }

    , enforceFocus: function () {
        var that = this
        $(document)
          .off('focusin.bs.modal') // guard against infinite focus loop
          .on('focusin.bs.modal', function (e) {
          if (that.$element[0] !== e.target && !$(e.target).parents('.bootstrap-modal').length) {
            that.$element.focus()
          }
        })
      }

    , escape: function () {
        var that = this
        if (this.isShown && this.options.keyboard) {
          this.$element.on('keyup.dismiss.modal', function ( e ) {
            e.which == 27 && that.hide()
          })
        } else if (!this.isShown) {
          this.$element.off('keyup.dismiss.modal')
        }
      }

    , hideWithTransition: function () {
        var that = this
          , timeout = setTimeout(function () {
              that.$element.off($.support.transition.end)
              that.hideModal()
            }, 500)

        this.$element.one($.support.transition.end, function () {
          clearTimeout(timeout)
          that.hideModal()
        })
      }

    , hideModal: function () {
        var that = this
        this.$element.hide()
        this.backdrop(function () {
          that.removeBackdrop()
          that.$element.trigger('hidden')
        })
      }

    , removeBackdrop: function () {
        this.$backdrop && this.$backdrop.remove()
        this.$backdrop = null
      }

    , backdrop: function (callback) {
        var that = this
          , animate = this.$element.hasClass('fade') ? 'fade' : ''

        if (this.isShown && this.options.backdrop) {
          var doAnimate = $.support.transition && animate

          this.$backdrop = $('<div class="modal-backdrop ' + animate + '" />')
            .appendTo(document.body)

          this.$backdrop.click(
            this.options.backdrop == 'static' ?
              $.proxy(this.$element[0].focus, this.$element[0])
            : $.proxy(this.hide, this)
          )

          if (doAnimate) this.$backdrop[0].offsetWidth // force reflow

          this.$backdrop.addClass('in')

          if (!callback) return

          doAnimate ?
            this.$backdrop.one($.support.transition.end, callback) :
            callback()

        } else if (!this.isShown && this.$backdrop) {
          this.$backdrop.removeClass('in')

          $.support.transition && this.$element.hasClass('fade')?
            this.$backdrop.one($.support.transition.end, callback) :
            callback()

        } else if (callback) {
          callback()
        }
      }
  }


 /* MODAL PLUGIN DEFINITION
  * ======================= */

  var old = $.fn.modal

  $.fn.modal = function (option) {
    return this.each(function () {
      var $this = $(this)
        , data = $this.data('modal')
        , options = $.extend({}, $.fn.modal.defaults, $this.data(), typeof option == 'object' && option)
      if (!data) $this.data('modal', (data = new Modal(this, options)))
      if (typeof option == 'string') data[option]()
      else if (options.show) data.show()
    })
  }

  $.fn.modal.defaults = {
      backdrop: true
    , keyboard: true
    , show: true
  }

  $.fn.modal.Constructor = Modal


 /* MODAL NO CONFLICT
  * ================= */

  $.fn.modal.noConflict = function () {
    $.fn.modal = old
    return this
  }


 /* MODAL DATA-API
  * ============== */

  $(document).on('click.modal.data-api', '[data-toggle="modal"]', function (e) {
    var $this = $(this)
      , href = $this.attr('href')
      , $target = $($this.attr('data-target') || (href && href.replace(/.*(?=#[^\s]+$)/, ''))) //strip for ie7
      , option = $target.data('modal') ? 'toggle' : $.extend({ remote:!/#/.test(href) && href }, $target.data(), $this.data())

    e.preventDefault()

    $target
      .modal(option)
      .one('hide', function () {
        $this.focus()
      })
  })

}(window.jQuery);
});
KAdefine("third_party/javascript-khansrc/Modernizr/modernizr.js", function(__KA_require, __KA_module, __KA_exports) {
/*! Modernizr 3.0.0-beta (Custom Build) | MIT
 *  Build: http://modernizr.com/download/#-flexbox-flexboxtweener-touchevents-cssclasses-dontmin-cssclassprefix:modernizr-
 */
;(function(window, document, undefined){

  var classes = [];
  

  var tests = [];
  

  var ModernizrProto = {
    // The current version, dummy
    _version: 'v3.0.0pre',

    // Any settings that don't work as separate modules
    // can go in here as configuration.
    _config: {
      classPrefix : 'modernizr-',
      enableClasses : true,
      usePrefixes : true
    },

    // Queue of tests
    _q: [],

    // Stub these for people who are listening
    on: function( test, cb ) {
      // I don't really think people should do this, but we can
      // safe guard it a bit.
      // -- NOTE:: this gets WAY overridden in src/addTest for
      // actual async tests. This is in case people listen to
      // synchronous tests. I would leave it out, but the code
      // to *disallow* sync tests in the real version of this
      // function is actually larger than this.
      setTimeout(function() {
        cb(this[test]);
      }, 0);
    },

    addTest: function( name, fn, options ) {
      tests.push({name : name, fn : fn, options : options });
    },

    addAsyncTest: function (fn) {
      tests.push({name : null, fn : fn});
    }
  };

  

  // Fake some of Object.create
  // so we can force non test results
  // to be non "own" properties.
  var Modernizr = function(){};
  Modernizr.prototype = ModernizrProto;

  // Leak modernizr globally when you `require` it
  // rather than force it here.
  // Overwrite name so constructor name is nicer :D
  Modernizr = new Modernizr();

  

  /**
   * is returns a boolean for if typeof obj is exactly type.
   */
  function is( obj, type ) {
    return typeof obj === type;
  }
  ;

  // Run through all tests and detect their support in the current UA.
  function testRunner() {
    var featureNames;
    var feature;
    var aliasIdx;
    var result;
    var nameIdx;
    var featureName;
    var featureNameSplit;

    for ( var featureIdx in tests ) {
      featureNames = [];
      feature = tests[featureIdx];
      // run the test, throw the return value into the Modernizr,
      //   then based on that boolean, define an appropriate className
      //   and push it into an array of classes we'll join later.
      //
      //   If there is no name, it's an 'async' test that is run,
      //   but not directly added to the object. That should
      //   be done with a post-run addTest call.
      if ( feature.name ) {
        featureNames.push(feature.name.toLowerCase());

        if (feature.options && feature.options.aliases && feature.options.aliases.length) {
          // Add all the aliases into the names list
          for (aliasIdx = 0; aliasIdx < feature.options.aliases.length; aliasIdx++) {
            featureNames.push(feature.options.aliases[aliasIdx].toLowerCase());
          }
        }
      }

      // Run the test, or use the raw value if it's not a function
      result = is(feature.fn, 'function') ? feature.fn() : feature.fn;


      // Set each of the names on the Modernizr object
      for (nameIdx = 0; nameIdx < featureNames.length; nameIdx++) {
        featureName = featureNames[nameIdx];
        // Support dot properties as sub tests. We don't do checking to make sure
        // that the implied parent tests have been added. You must call them in
        // order (either in the test, or make the parent test a dependency).
        //
        // Cap it to TWO to make the logic simple and because who needs that kind of subtesting
        // hashtag famous last words
        featureNameSplit = featureName.split('.');

        if (featureNameSplit.length === 1) {
          Modernizr[featureNameSplit[0]] = result;
        }
        else if (featureNameSplit.length === 2) {
          // cast to a Boolean, if not one already
          /* jshint -W053 */
          if (Modernizr[featureNameSplit[0]] && !(Modernizr[featureNameSplit[0]] instanceof Boolean)) {
            Modernizr[featureNameSplit[0]] = new Boolean(Modernizr[featureNameSplit[0]]);
          }

          Modernizr[featureNameSplit[0]][featureNameSplit[1]] = result;
        }

        classes.push((result ? '' : 'no-') + featureNameSplit.join('-'));
      }
    }
  }

  ;

  var docElement = document.documentElement;
  

  // Pass in an and array of class names, e.g.:
  //  ['no-webp', 'borderradius', ...]
  function setClasses( classes ) {
    var className = docElement.className;
    var classPrefix = Modernizr._config.classPrefix || '';

    // Change `no-js` to `js` (we do this regardles of the `enableClasses`
    // option)
    // Handle classPrefix on this too
    var reJS = new RegExp('(^|\\s)'+classPrefix+'no-js(\\s|$)');
    className = className.replace(reJS, '$1'+classPrefix+'js$2');

    if(Modernizr._config.enableClasses) {
      // Add the new classes
      className += ' ' + classPrefix + classes.join(' ' + classPrefix);
      docElement.className = className;
    }

  }

  ;

  // List of property values to set for css tests. See ticket #21
  var prefixes = (ModernizrProto._config.usePrefixes ? ' -webkit- -moz- -o- -ms- '.split(' ') : []);

  // expose these for the plugin API. Look in the source for how to join() them against your input
  ModernizrProto._prefixes = prefixes;

  

  var createElement = function() {
    return document.createElement.apply(document, arguments);
  };
  

  function getBody() {
    // After page load injecting a fake body doesn't work so check if body exists
    var body = document.body;

    if(!body) {
      // Can't use the real body create a fake one.
      body = createElement('body');
      body.fake = true;
    }

    return body;
  }

  ;

  // Inject element with style element and some CSS rules
  function injectElementWithStyles( rule, callback, nodes, testnames ) {
    var mod = 'modernizr';
    var style;
    var ret;
    var node;
    var docOverflow;
    var div = createElement('div');
    var body = getBody();

    if ( parseInt(nodes, 10) ) {
      // In order not to give false positives we create a node for each test
      // This also allows the method to scale for unspecified uses
      while ( nodes-- ) {
        node = createElement('div');
        node.id = testnames ? testnames[nodes] : mod + (nodes + 1);
        div.appendChild(node);
      }
    }

    // <style> elements in IE6-9 are considered 'NoScope' elements and therefore will be removed
    // when injected with innerHTML. To get around this you need to prepend the 'NoScope' element
    // with a 'scoped' element, in our case the soft-hyphen entity as it won't mess with our measurements.
    // msdn.microsoft.com/en-us/library/ms533897%28VS.85%29.aspx
    // Documents served as xml will throw if using ­ so use xml friendly encoded version. See issue #277
    style = ['­','<style id="s', mod, '">', rule, '</style>'].join('');
    div.id = mod;
    // IE6 will false positive on some tests due to the style element inside the test div somehow interfering offsetHeight, so insert it into body or fakebody.
    // Opera will act all quirky when injecting elements in documentElement when page is served as xml, needs fakebody too. #270
    (!body.fake ? div : body).innerHTML += style;
    body.appendChild(div);
    if ( body.fake ) {
      //avoid crashing IE8, if background image is used
      body.style.background = '';
      //Safari 5.13/5.1.4 OSX stops loading if ::-webkit-scrollbar is used and scrollbars are visible
      body.style.overflow = 'hidden';
      docOverflow = docElement.style.overflow;
      docElement.style.overflow = 'hidden';
      docElement.appendChild(body);
    }

    ret = callback(div, rule);
    // If this is done after page load we don't want to remove the body so check if body exists
    if ( body.fake ) {
      body.parentNode.removeChild(body);
      docElement.style.overflow = docOverflow;
      // Trigger layout so kinetic scrolling isn't disabled in iOS6+
      docElement.offsetHeight;
    } else {
      div.parentNode.removeChild(div);
    }

    return !!ret;

  }

  ;

  var testStyles = ModernizrProto.testStyles = injectElementWithStyles;
  
/*!
{
  "name": "Touch Events",
  "property": "touchevents",
  "caniuse" : "touch",
  "tags": ["media", "attribute"],
  "notes": [{
    "name": "Touch Events spec",
    "href": "http://www.w3.org/TR/2013/WD-touch-events-20130124/"
  }],
  "warnings": [
    "Indicates if the browser supports the Touch Events spec, and does not necessarily reflect a touchscreen device"
  ],
  "knownBugs": [
    "False-positive on some configurations of Nokia N900",
    "False-positive on some BlackBerry 6.0 builds – https://github.com/Modernizr/Modernizr/issues/372#issuecomment-3112695"
  ]
}
!*/
/* DOC
Indicates if the browser supports the W3C Touch Events API.

This *does not* necessarily reflect a touchscreen device:

* Older touchscreen devices only emulate mouse events
* Modern IE touch devices implement the Pointer Events API instead: use `Modernizr.pointerevents` to detect support for that
* Some browsers & OS setups may enable touch APIs when no touchscreen is connected
* Future browsers may implement other event models for touch interactions

See this article: [You Can't Detect A Touchscreen](http://www.stucox.com/blog/you-cant-detect-a-touchscreen/).

It's recommended to bind both mouse and touch/pointer events simultaneously – see [this HTML5 Rocks tutorial](http://www.html5rocks.com/en/mobile/touchandmouse/).

This test will also return `true` for Firefox 4 Multitouch support.
*/

  // Chrome (desktop) used to lie about its support on this, but that has since been rectified: http://crbug.com/36415
  Modernizr.addTest('touchevents', function() {
    var bool;
    if(('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch) {
      bool = true;
    } else {
      var query = ['@media (',prefixes.join('touch-enabled),('),'heartz',')','{#modernizr{top:9px;position:absolute}}'].join('');
      testStyles(query, function( node ) {
        bool = node.offsetTop === 9;
      });
    }
    return bool;
  });


  // Following spec is to expose vendor-specific style properties as:
  //   elem.style.WebkitBorderRadius
  // and the following would be incorrect:
  //   elem.style.webkitBorderRadius

  // Webkit ghosts their properties in lowercase but Opera & Moz do not.
  // Microsoft uses a lowercase `ms` instead of the correct `Ms` in IE8+
  //   erik.eae.net/archives/2008/03/10/21.48.10/

  // More here: github.com/Modernizr/Modernizr/issues/issue/21
  var omPrefixes = 'Webkit Moz O ms';
  

  var cssomPrefixes = (ModernizrProto._config.usePrefixes ? omPrefixes.split(' ') : []);
  ModernizrProto._cssomPrefixes = cssomPrefixes;
  

  var domPrefixes = (ModernizrProto._config.usePrefixes ? omPrefixes.toLowerCase().split(' ') : []);
  ModernizrProto._domPrefixes = domPrefixes;
  

  /**
   * contains returns a boolean for if substr is found within str.
   */
  function contains( str, substr ) {
    return !!~('' + str).indexOf(substr);
  }

  ;

  // Change the function's scope.
  function fnBind(fn, that) {
    return function() {
      return fn.apply(that, arguments);
    };
  }

  ;

  /**
   * testDOMProps is a generic DOM property test; if a browser supports
   *   a certain property, it won't return undefined for it.
   */
  function testDOMProps( props, obj, elem ) {
    var item;

    for ( var i in props ) {
      if ( props[i] in obj ) {

        // return the property name as a string
        if (elem === false) return props[i];

        item = obj[props[i]];

        // let's bind a function
        if (is(item, 'function')) {
          // bind to obj unless overriden
          return fnBind(item, elem || obj);
        }

        // return the unbound function or obj or value
        return item;
      }
    }
    return false;
  }

  ;

  /**
   * Create our "modernizr" element that we do most feature tests on.
   */
  var modElem = {
    elem : createElement('modernizr')
  };

  // Clean up this element
  Modernizr._q.push(function() {
    delete modElem.elem;
  });

  

  var mStyle = {
    style : modElem.elem.style
  };

  // kill ref for gc, must happen before
  // mod.elem is removed, so we unshift on to
  // the front of the queue.
  Modernizr._q.unshift(function() {
    delete mStyle.style;
  });

  

  // Helper function for converting camelCase to kebab-case,
  // e.g. boxSizing -> box-sizing
  function domToCSS( name ) {
    return name.replace(/([A-Z])/g, function(str, m1) {
      return '-' + m1.toLowerCase();
    }).replace(/^ms-/, '-ms-');
  }
  ;

  // Function to allow us to use native feature detection functionality if available.
  // Accepts a list of property names and a single value
  // Returns `undefined` if native detection not available
  function nativeTestProps ( props, value ) {
    var i = props.length;
    // Start with the JS API: http://www.w3.org/TR/css3-conditional/#the-css-interface
    if ('CSS' in window && 'supports' in window.CSS) {
      // Try every prefixed variant of the property
      while (i--) {
        if (window.CSS.supports(domToCSS(props[i]), value)) {
          return true;
        }
      }
      return false;
    }
    // Otherwise fall back to at-rule (for FF 17 and Opera 12.x)
    else if ('CSSSupportsRule' in window) {
      // Build a condition string for every prefixed variant
      var conditionText = [];
      while (i--) {
        conditionText.push('(' + domToCSS(props[i]) + ':' + value + ')');
      }
      conditionText = conditionText.join(' or ');
      return injectElementWithStyles('@supports (' + conditionText + ') { #modernizr { position: absolute; } }', function( node ) {
        return (window.getComputedStyle ?
                getComputedStyle(node, null) :
                node.currentStyle)['position'] == 'absolute';
      });
    }
    return undefined;
  }
  ;

  // testProps is a generic CSS / DOM property test.

  // In testing support for a given CSS property, it's legit to test:
  //    `elem.style[styleName] !== undefined`
  // If the property is supported it will return an empty string,
  // if unsupported it will return undefined.

  // We'll take advantage of this quick test and skip setting a style
  // on our modernizr element, but instead just testing undefined vs
  // empty string.

  // Because the testing of the CSS property names (with "-", as
  // opposed to the camelCase DOM properties) is non-portable and
  // non-standard but works in WebKit and IE (but not Gecko or Opera),
  // we explicitly reject properties with dashes so that authors
  // developing in WebKit or IE first don't end up with
  // browser-specific content by accident.

  function testProps( props, prefixed, value, skipValueTest ) {
    skipValueTest = is(skipValueTest, 'undefined') ? false : skipValueTest;

    // Try native detect first
    if (!is(value, 'undefined')) {
      var result = nativeTestProps(props, value);
      if(!is(result, 'undefined')) {
        return result;
      }
    }

    // Otherwise do it properly
    var afterInit, i, prop, before;

    // If we don't have a style element, that means
    // we're running async or after the core tests,
    // so we'll need to create our own elements to use
    if ( !mStyle.style ) {
      afterInit = true;
      mStyle.modElem = createElement('modernizr');
      mStyle.style = mStyle.modElem.style;
    }

    // Delete the objects if we
    // we created them.
    function cleanElems() {
      if (afterInit) {
        delete mStyle.style;
        delete mStyle.modElem;
      }
    }

    for ( i in props ) {
      prop = props[i];
      before = mStyle.style[prop];

      if ( !contains(prop, '-') && mStyle.style[prop] !== undefined ) {

        // If value to test has been passed in, do a set-and-check test.
        // 0 (integer) is a valid property value, so check that `value` isn't
        // undefined, rather than just checking it's truthy.
        if (!skipValueTest && !is(value, 'undefined')) {

          // Needs a try catch block because of old IE. This is slow, but will
          // be avoided in most cases because `skipValueTest` will be used.
          try {
            mStyle.style[prop] = value;
          } catch (e) {}

          // If the property value has changed, we assume the value used is
          // supported. If `value` is empty string, it'll fail here (because
          // it hasn't changed), which matches how browsers have implemented
          // CSS.supports()
          if (mStyle.style[prop] != before) {
            cleanElems();
            return prefixed == 'pfx' ? prop : true;
          }
        }
        // Otherwise just return true, or the property name if this is a
        // `prefixed()` call
        else {
          cleanElems();
          return prefixed == 'pfx' ? prop : true;
        }
      }
    }
    cleanElems();
    return false;
  }

  ;

  /**
   * testPropsAll tests a list of DOM properties we want to check against.
   *     We specify literally ALL possible (known and/or likely) properties on
   *     the element including the non-vendor prefixed one, for forward-
   *     compatibility.
   */
  function testPropsAll( prop, prefixed, elem, value, skipValueTest ) {

    var ucProp = prop.charAt(0).toUpperCase() + prop.slice(1),
    props = (prop + ' ' + cssomPrefixes.join(ucProp + ' ') + ucProp).split(' ');

    // did they call .prefixed('boxSizing') or are we just testing a prop?
    if(is(prefixed, 'string') || is(prefixed, 'undefined')) {
      return testProps(props, prefixed, value, skipValueTest);

      // otherwise, they called .prefixed('requestAnimationFrame', window[, elem])
    } else {
      props = (prop + ' ' + (domPrefixes).join(ucProp + ' ') + ucProp).split(' ');
      return testDOMProps(props, prefixed, elem);
    }
  }

  // Modernizr.testAllProps() investigates whether a given style property,
  //     or any of its vendor-prefixed variants, is recognized
  // Note that the property names must be provided in the camelCase variant.
  // Modernizr.testAllProps('boxSizing')
  ModernizrProto.testAllProps = testPropsAll;

  

  /**
   * testAllProps determines whether a given CSS property, in some prefixed
   * form, is supported by the browser. It can optionally be given a value; in
   * which case testAllProps will only return true if the browser supports that
   * value for the named property; this latter case will use native detection
   * (via window.CSS.supports) if available. A boolean can be passed as a 3rd
   * parameter to skip the value check when native detection isn't available,
   * to improve performance when simply testing for support of a property.
   *
   * @param prop - String naming the property to test
   * @param value - [optional] String of the value to test
   * @param skipValueTest - [optional] Whether to skip testing that the value
   *                        is supported when using non-native detection
   *                        (default: false)
   */
  function testAllProps (prop, value, skipValueTest) {
    return testPropsAll(prop, undefined, undefined, value, skipValueTest);
  }
  ModernizrProto.testAllProps = testAllProps;
  
/*!
{
  "name": "Flexbox",
  "property": "flexbox",
  "caniuse": "flexbox",
  "tags": ["css"],
  "notes": [{
    "name": "The _new_ flexbox",
    "href": "http://dev.w3.org/csswg/css3-flexbox"
  }],
  "warnings": [
    "A `true` result for this detect does not imply that the `flex-wrap` property is supported; see the `flexwrap` detect."
  ]
}
!*/
/* DOC
Detects support for the Flexible Box Layout model, a.k.a. Flexbox, which allows easy manipulation of layout order and sizing within a container.
*/

  Modernizr.addTest('flexbox', testAllProps('flexBasis', '1px', true));

/*!
{
  "name": "Flexbox (tweener)",
  "property": "flexboxtweener",
  "tags": ["css"],
  "polyfills": ["flexie"],
  "notes": [{
    "name": "The _inbetween_ flexbox",
    "href": "http://www.w3.org/TR/2011/WD-css3-flexbox-20111129/"
  }]
}
!*/

  Modernizr.addTest('flexboxtweener', testAllProps('flexAlign', 'end', true));


  // Run each test
  testRunner();

  // Remove the "no-js" class if it exists
  setClasses(classes);

  delete ModernizrProto.addTest;
  delete ModernizrProto.addAsyncTest;

  // Run the things that are supposed to run after the tests
  for (var i = 0; i < Modernizr._q.length; i++) {
    Modernizr._q[i]();
  }

  // Leak Modernizr namespace
  window.Modernizr = Modernizr;



})(this, document);
__KA_module.exports = Modernizr;
this.Modernizr = Modernizr;
});
KAdefine("javascript/shared-package/local-store.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-undef, one-var, prefer-template, space-after-keywords */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * LocalStore is a *super* simple abstraction around localStorage for easy
 * get/set/delete. We may end up wanting something more powerful like
 * BankersBox, but for now this is much lighter weight.
 *
 * If you ever need to completely wipe LocalStore for *all* users when,
 * say, changing the format of data being cached, just bump up the "version"
 * property below.
 */
window.LocalStore = { 

    // Bump up "version" any time you want to completely wipe LocalStore results.
    // This lets us expire values on all users' LocalStores when deploying
    // a new version, if necessary.
    version: 4, 

    keyPrefix: "ka", 

    cacheKey: function (key) {
        if (!key) {
            throw new Error("Attempting to use LocalStore without a key");}


        return [this.keyPrefix, this.version, key].join(":");}, 


    /**
     * Get whatever data was associated with key. Returns null if no data is
     * associated with the key, regardless of key's value (null, undefined, "monkey").
     */
    get: function (key) {
        if (!this.isEnabled()) {
            return undefined;}


        try {
            var data = window.localStorage[LocalStore.cacheKey(key)];
            if (data) {
                return JSON.parse(data);}} 

        catch (e) {}




        return null;}, 


    /**
     * Store data associated with key in localStorage
     */
    set: function (key, data) {
        if (!this.isEnabled()) {
            throw new Error("LocalStore is not enabled");}

        var stringified = JSON.stringify(data), 
        cacheKey = LocalStore.cacheKey(key);

        try {
            window.localStorage[cacheKey] = stringified;} 
        catch (e) {
            // If we had trouble storing in localStorage, we may've run over
            // the browser's 5MB limit. This should be rare, but when hit, clear
            // everything out.
            LocalStore.clearAll();}}, 



    /**
     * Delete whatever data was associated with key
     */
    del: function (key) {
        if (!this.isEnabled()) {
            return;}

        var cacheKey = this.cacheKey(key);
        if (cacheKey in window.localStorage) {
            // IE throws when deleting a key that's not currently in
            // localStorage.
            delete window.localStorage[cacheKey];}}, 



    isEnabled: function () {
        var enabled, uid = String(+new Date());
        try {
            window.sessionStorage[uid] = uid;
            enabled = window.sessionStorage[uid] === uid;
            window.sessionStorage.removeItem(uid);
            return enabled;} 
        catch (e) {
            return false;}}, 



    /**
     * Delete all cached objects from localStorage
     */
    clearAll: function () {
        if (!this.isEnabled()) {
            return;}

        try {
            var i = 0;
            while (i < localStorage.length) {
                var key = localStorage.key(i);
                if (key.indexOf(LocalStore.keyPrefix + ":") === 0) {
                    delete localStorage[key];} else 
                {
                    i++;}}} 


        catch (e) {}} };







module.exports = LocalStore; // If we had trouble retrieving, like FF's NS_FILE_CORRUPTED
// http://stackoverflow.com/questions/18877643/error-in-local-storage-ns-error-file-corrupted-firefox
// If we had trouble accessing .length, like FF's NS_FILE_CORRUPTED
// http://stackoverflow.com/questions/18877643/error-in-local-storage-ns-error-file-corrupted-firefox
});
KAdefine("javascript/shared-package/regex-util.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * escapeRegex taken from jquery.ui.autocomplete so we can use it without
 * importing the entire file.
 */
function escapeRegex(value) {
    return value.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g, "\\$&");}


/**
 * Creates an accent insensitive RegExp string, inspired by
 * http://stackoverflow.com/a/228006. This only returns the string, e.g.
 * "c[EeèéÉ]z[Aaàá]nn[EeèéÉ]", rather than a RegExp. Also escapes control
 * characters. The assumption is the input is taken from the user and the
 * output is a safe way to match an accented string.
 * @param {string} searchString string to match accent-insensitively
 * @param {string} opts RegExp options, like 'i' or 'gi'
 */
function accentInsensitive(searchString) {
    // Just replace any character that can have an accent by class of all
    // its variations. Example:
    //     /cezanne/ -> /c[EeèéÉ]z[Aaàá]nn[EeèéÉ]/
    searchString = escapeRegex(searchString);
    var accentReplacer = function (chr) {
        return accentedAndNormalRegexChars[chr.toUpperCase()] || chr;};

    searchString = searchString.replace(/\S/g, accentReplacer);
    return searchString;}


/* These are the unicode characters we want to match, indexed by uppercase
 * version of the ascii character we want to match them. Some other unicode
 * characters occur in our titles - '\u2013' (en-dash) and '\u2019' (right
 * single quotation mark). We just ignore them since they're not word
 * characters.
 */
var accentedChars = { 
    "A": "àá", 
    "E": "èéÉ", 
    "I": "í", 
    "O": "ò-ö", 
    "U": "ùü" };


/*
 * Built from accentedChars, these are regex strings that match either
 * the accented versions of characters *or* the non-accented versions.
 * The data structure looks like this:
 * {
 *     "A": "[Aa\xe0\xe1]",  // matches "A", "a", and accented a's.
 *     ...
 * }
 */
var accentedAndNormalRegexChars = Object.entries(accentedChars).reduce(
function (result, _ref2) {var c = _ref2[0];var chars = _ref2[1];
    result[c] = "[" + c + "" + c.toLowerCase() + "" + chars + "]";
    return result;}, 
{});

/*
 * Built from accentedChars, these are regex strings that match only
 * the accented versions of characters.
 * The data structure looks like this:
 * {
 *     "A": "[\xe0\xe1]",  // matches accented a's only.
 *     ...
 * }
 */
var accentedRegexChars = Object.entries(accentedChars).reduce(
function (result, _ref3) {var c = _ref3[0];var chars = _ref3[1];
    result[c] = "[" + chars + "]";
    return result;}, 
{});

/*
 * These are precompiled regexes for matching the above accented characters
 * replacing with their non-accented lowercase counterparts.
 * The data structure looks like this: {
 *   "a": new RegExp("[\xe0\xe1]", "g"),
 *   "e": ...
 * }
 */
var accentedCharRegexes = {};
for (var _iterator = Object.entries(accentedRegexChars), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {var _ref;if (_isArray) {if (_i >= _iterator.length) break;_ref = _iterator[_i++];} else {_i = _iterator.next();if (_i.done) break;_ref = _i.value;}var c = _ref[0];var needle = _ref[1]; // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
    accentedCharRegexes[c.toLowerCase()] = new RegExp(needle, "g");}


/*
 * anyAccentedCharRegex is a precompiled regex for detecting the existence
 * of *any* of the above accentedRegexChars. It will match any string that
 * has at least one accented char.
 */
var anyAccentNeedles = Object.values(accentedRegexChars).join("|");
var anyAccentedCharRegex = new RegExp(anyAccentNeedles);

module.exports = { 
    escapeRegex: escapeRegex, 
    accentInsensitive: accentInsensitive, 
    accentedCharRegexes: accentedCharRegexes, 
    anyAccentedCharRegex: anyAccentedCharRegex };
});
KAdefine("javascript/shared-package/cookies.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, eqeqeq, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var createCookie = function (name, value, days, domain) {
    var expires;
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
        expires = "; expires=" + date.toGMTString();} else 
    {
        expires = "";}

    if (domain) {
        domain = "; domain=" + domain;} else 
    {
        domain = "";}

    document.cookie = name + "=" + value + expires + domain + "; path=/";};


var readCookie = function (name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === " ") {
            c = c.substring(1, c.length);}

        if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length, c.length);}}


    return null;};


var eraseCookie = function (name, domain) {
    createCookie(name, "", -1, domain);};


var areCookiesEnabled = function () {
    createCookie("detectCookiesEnabled", "KhanAcademy");
    if (readCookie("detectCookiesEnabled") == null) {
        return false;}

    eraseCookie("detectCookiesEnabled");
    return true;};


module.exports = { 
    createCookie: createCookie, 
    readCookie: readCookie, 
    eraseCookie: eraseCookie, 
    areCookiesEnabled: areCookiesEnabled };
});
KAdefine("javascript/shared-package/underscore-extensions.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var _ = require("underscore");

_.mixin({ 
    /**
     * _.renameKeys: selectively rename some of the keys in an object.
     *
     * // Rename 'a' to 'x'
     * > _({a: 1, b: 2}).renameKeys({a: 'x'})
     * {x: 1, b: 2}
     *
     * // .renameKeys({}) returns the original object
     * > _({a: 1}).renameKeys({})
     * {a: 1}
     *
     * // The name map can have extra keys
     * > _({a: 1}).renameKeys({b: 'y', c: 'z'})
     * {a: 1}
     */
    renameKeys: function (obj, map) {
        var newObj = {};
        _(obj).each(function (value, key) {
            var newKey = map[key] || key;
            newObj[newKey] = value;});

        return newObj;}, 


    /**
     * _.intersperse: Return an array with the separator interspersed between
     * each element of the input array. The separator may be callable.
     *
     * > _([1,2,3]).intersperse(0)
     * [1,0,2,0,3]
     *
     * > _([1,2,3]).intersperse(_.identity)
     * [1,0,2,1,3]
     */
    intersperse: function (lst, f) {
        if (lst.length === 0) {
            return [];}


        return _.reduce(lst.slice(1), function (xs, x, i) {
            // Call f if it's callable, otherwise just insert the value
            var value = typeof f === "function" ? f(i) : f;
            return xs.concat([value, x]);}, 
        [lst[0]]);}, 


    /**
     * _.indexBy: Like groupBy, but assumes there is a unique key for each
     * element.
     *
     * > _.indexBy([1, 2, 3], _.identity)
     * {1: 1, 2: 2, 3: 3}
     *
     * > _.indexBy([{x: 1, y: 2}, {x: 2, y: 3}], function(point) {
     * >     return point.x;
     * > })
     * {1: {x: 1, y: 2}, 2: {x: 2, y: 3}}
     *
     * // A shorter version of the previous example
     * > _.indexBy([{x: 1, y: 2}, {x: 2, y: 3}], 'x')
     * {1: {x: 1, y: 2}, 2: {x: 2, y: 3}}
     */
    indexBy: function (sequence, keyExtractor) {
        var keyExtractorFn = null;
        if (typeof keyExtractor === "string") {
            keyExtractorFn = function (el) {return el[keyExtractor];};} else 
        {
            keyExtractorFn = keyExtractor;}


        return _.reduce(sequence, function (m, el) {
            m[keyExtractorFn(el)] = el;
            return m;}, 
        {});}, 


    /**
     * _.findIndex: Like _.find, but returns the index of the first
     * satisfactory element rather than the element itself.
     *
     * _.findIndex([1, 2, 3], function(x) { return x % 2 == 0; });
     * => 1
     *
     * _.findIndex([1, 2, 3], function(x) { return x % 3 == 0; });
     * => 2
     *
     * _.findIndex([1, 2, 3], function(x) { return x % 6 == 0; });
     * => undefined
     */
    findIndex: function (sequence, predicate, context) {
        var result;
        _.any(sequence, function (value, index, list) {
            if (predicate.call(context, value, index, list)) {
                result = index;
                return true;}});


        return result;}, 


    // TODO(joel) - remove when we upgrade underscore
    matches: function (attrs) {
        return function (obj) {
            //avoid comparing an object to itself.
            if (obj === attrs) {
                return true;}


            for (var key in attrs) {
                if (attrs[key] !== obj[key]) {
                    return false;}}



            return true;};}, 



    /**
     * _.indexWhere: Like findWhere, but returns the index rather than value.
     *
     * > _.indexWhere([{ name: "a" }, { name: "b" }], { name: "a" });
     * 0
     */
    indexWhere: function (obj, attrs) {
        return _.findIndex(obj, _.matches(attrs));} });
});
KAdefine("javascript/shared-package/autolink.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

// from http://daringfireball.net/2010/07/improved_regex_for_matching_urls
var regex = /\b(?:(?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>&]+|&amp;|\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\))+(?:\((?:[^\s()<>]|(?:\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’&]))/ig;

var Autolink = { 
    autolink: function (text, nofollow) {
        return text.replace(regex, function (url) {
            if (!/^https?:\/\//.test(url)) {
                url = "http://" + url;}


            var nofollowAttr = nofollow ? "rel=\"nofollow\"" : "";

            return "<a " + nofollowAttr + " href=\"" + url + "\">" + url + "</a>";});} };




module.exports = Autolink;
});
KAdefine("third_party/javascript-khansrc/async/async.js", function(__KA_require, __KA_module, __KA_exports) {
/**
 * This is a small part of the async library[1]. From the project description:
 *
 * > Async is a utility module which provides straight-forward, powerful
 * > functions for working with asynchronous JavaScript.
 *
 * Unused functions have been deleted to save space, so if you need them, feel
 * free to add them back in.
 *
 * [1]: https://github.com/caolan/async
 */

/*global setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root = this,
        previous_async = root.async;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    else {
        root.async = async;
    }

    function only_once(fn) {
        var called = false;
        return function() {
            if (called) throw new Error("Callback was already called.");
            called = true;
            fn.apply(root, arguments);
        }
    }

    //// cross-browser compatiblity functions ////

    var _each = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        if (typeof setImmediate === 'function') {
            async.nextTick = function (fn) {
                // not a direct alias for IE10 compatibility
                setImmediate(fn);
            };
            async.setImmediate = async.nextTick;
        }
        else {
            async.nextTick = function (fn) {
                setTimeout(fn, 0);
            };
            async.setImmediate = async.nextTick;
        }
    }
    else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== 'undefined') {
            async.setImmediate = setImmediate;
        }
        else {
            async.setImmediate = async.nextTick;
        }
    }

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.queue = function (worker, concurrency) {
        if (concurrency === undefined) {
            concurrency = 1;
        }
        function _insert(q, data, pos, callback) {
          if(data.constructor !== Array) {
              data = [data];
          }
          _each(data, function(task) {
              var item = {
                  data: task,
                  callback: typeof callback === 'function' ? callback : null
              };

              if (pos) {
                q.tasks.unshift(item);
              } else {
                q.tasks.push(item);
              }

              if (q.saturated && q.tasks.length === concurrency) {
                  q.saturated();
              }
              async.setImmediate(q.process);
          });
        }

        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
              _insert(q, data, false, callback);
            },
            unshift: function (data, callback) {
              _insert(q, data, true, callback);
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if (q.empty && q.tasks.length === 0) {
                        q.empty();
                    }
                    workers += 1;
                    var next = function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if (q.drain && q.tasks.length + workers === 0) {
                            q.drain();
                        }
                        q.process();
                    };
                    var cb = only_once(next);
                    worker(task.data, cb);
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

}());
__KA_module.exports = async;
this.async = async;
});
KAdefine("javascript/shared-package/analytics.js", function(require, module, exports) {
/**
 * A set of utilities to track user interactions on the website.
 *
 * This has code we use to collect timing data and send it to
 * appengine for logging and analysis.
 *
 * Events can be either instantaneous or have a duration, and only one
 * non-instantaneous event can be occurring at a time. If another
 * event is begun, the previous event is ended automatically.
 *
 * The utility also attempts to resend events that happen just before
 * the page is unloaded or on pages that are unloaded before the
 * sending script is fully loaded.
 */

var BigBingo = require("./bigbingo.js");
var KA = require("./ka.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;var formUrlencode = _require.formUrlencode;
var VisitTracking = require("./visit-tracking.js");
var escapeRegex = require("./regex-util.js").escapeRegex;

// TODO(benkomalo): do this in a more appropriate common library.
// Patch Date.now for IE8.
var getNow = Date.now || function () {
    return +new Date();};


var currentPath = null;
var graphiteTimingMetricsReported = {};
var gaTimingMetricsReported = {};

// Client-side API endpoints
var Analytics = { 

    /////////////////////////////////////////////////////////////////
    //   Google Analytics / MixPanel API endpoints

    // Called once on every page load
    init: function () {
        currentPath = window.location.pathname;

        // Record initial page view in BigBingo
        BigBingo.markConversion("pageview", { 
            path: currentPath, 
            qs: window.location.search.slice(1), 
            utc: -new Date().getTimezoneOffset() });}, 



    // Called on every Backbone Router 'route' event
    handleRouterNavigation: function (isTutorialRoute) {

        // Track async page views to record return visits in BigBingo
        VisitTracking.trackVisit();

        // Only send certain events on url change
        if (currentPath && currentPath !== window.location.pathname) {
            currentPath = window.location.pathname;

            var pageViewData = { 
                path: currentPath, 
                qs: window.location.search.slice(1), 
                utc: -new Date().getTimezoneOffset() };


            // Record async page views in BigBingo
            if (isTutorialRoute === true) {
                BigBingo.markConversionsWithExtras([
                { 
                    id: "pageview", 
                    extra: pageViewData }, 
                { 
                    id: "tutorial_node_nav_click", 
                    extra: { 
                        node_clicked: currentPath.split("/")[
                        currentPath.split("/").length - 1] } }]);} else 



            {

                BigBingo.markConversion("pageview", pageViewData);}


            // Record async page views in Google Analytics
            ga("send", "pageview", currentPath);}}, 



    /////////////////////////////////////////////////////////////////
    //   Mixpanel API endpoints
    //
    // These are currently no-ops.  If we ever wanted to move over
    // to another analytics scheme, we could maybe re-enable this
    // logic for that scheme.
    trackInitialPageLoad: function (startTime) {}, 


    trackPageView: function (parameters, isSessionStart) {}, 


    trackActivityBegin: function (eventName, parameters) {}, 


    trackActivityEnd: function (event) {}, 


    trackSingleEvent: function (eventName, parameters) {
        return Promise.resolve();}, 


    /////////////////////////////////////////////////////////////////
    //   Appengine API endpoints

    // **NOTE**: if you add a key that is meant to be sent to graphite here,
    //           you *MUST* also add it to client_graphite_keys() in
    //           graphite_util.py.
    timingStats: { 
        REDIRECT_MS: "stats.time.client.redirect_ms", 
        DNS_MS: "stats.time.client.dns_ms", 
        CONNECT_MS: "stats.time.client.connect_ms", 
        REQUEST_MS: "stats.time.client.request_ms", 
        RESPONSE_MS: "stats.time.client.response_ms", 
        DOCUMENT_MS: "stats.time.client.document_ms", 
        CONTENT_LOADED_MS: "stats.time.client.content_loaded_ms", 
        START_TO_CONTENT_LOADED_MS: 
        "stats.time.client.start_to_content_loaded_ms", 
        RESOURCE_NET_MS: "stats.time.client.resource_net_ms", 
        RESOURCE_MS: "stats.time.client.resource_ms", 
        CLOUDFLARE_JSCSS_NET_MS: "stats.time.client.cloudflare_jscss_net_ms", 
        FASTLY_JSCSS_NET_MS: "stats.time.client.fastly_jscss_net_ms", 
        MAXCDN_JSCSS_NET_MS: "stats.time.client.maxcdn_jscss_net_ms", 
        KA_JSCSS_NET_MS: "stats.time.client.ka_jscss_net_ms", 
        KASTATIC_JSCSS_NET_MS: "stats.time.client.kastatic_jscss_net_ms", 

        // Time until the main Khan Academy-specific page content is
        // sufficiently usable. What "sufficiently usable" means is determined
        // on a per-page basis, depending on what content we think is
        // important, but in general means that the content of the page is
        // usable, and that navigation is usable. For example, on a video page
        // this means that the video loads and that navigation links work.
        SUFFICIENTLY_USABLE_MS: "stats.time.client.sufficiently_usable_ms" }, 


    /**
     * Send client-side timing stats to appengine for analysis.
     *
     * We get timing statistics from the navigation timing API, the
     * resource timing API, and for KA package execution, for browsers
     * that support it (all modern ones do).  We then hit an API
     * endpoint on appengine that is made for receiving such data.
     *
     * @returns {Promise} A Promise that resolves when the request to send the
     *     timings is done.
     */
    reportTiming: function () {
        if (!window.performance || !window.performance.timing) {
            return;}

        var timing = window.performance.timing;

        // These are in milliseconds since the epoch.  Taken from:
        // http://www.igvita.com/2012/04/04/measuring-site-speed-with-navigation-timing/
        // These timings are in order and exclusive, they could be
        // accurately visualized in a stacked graph.
        var startTime = timing.navigationStart;
        var redirectTime = timing.redirectEnd - timing.redirectStart;
        var dnsTime = timing.domainLookupEnd - timing.domainLookupStart;
        var connectTime = timing.connectEnd - timing.connectStart;
        var requestTime = timing.responseStart - timing.requestStart;
        var responseTime = timing.responseEnd - timing.responseStart;
        var documentTime = timing.domContentLoadedEventStart - 
        timing.responseEnd;
        var contentLoadedTime = timing.domContentLoadedEventEnd - 
        timing.domContentLoadedEventStart;

        // These timings may overlap the above.
        var readyTime = timing.domContentLoadedEventEnd - startTime;

        // These timings overlap the above, and give insight into time
        // spent (pre-DOMReady) downloading JS and CSS, running JS,
        // and doing "other stuff" like rendering. Notably, package
        // timings are always available, but resource timings are only
        // available in some clients, in fact a different subset of
        // clients than general network timings.
        var KAClientTiming = require("./ka-client-timing.js");
        var cutoff = timing.domContentLoadedEventStart;

        var resourceTimingApiTimes = {};
        if (KAClientTiming.clientHasResourceTimingAPI()) {
            var resourceTimings = KAClientTiming.getResourceEntries(
            /\.js$|\.css$/);

            resourceTimingApiTimes["net"] = 
            KAClientTiming.wallTime(resourceTimings, cutoff);

            if (typeof KA !== "undefined") {
                var re = new RegExp(
                "^https?://" + escapeRegex(KA.staticHost) + 
                "/.+\\.(?:css|js)$");
                var staticTimings = KAClientTiming.getResourceEntries(re);

                // When adding to this list, make sure to also add to the list
                // of keys set in `dataToGraphite` later in this file
                switch (KA.staticHost) {
                    case "cdn.kastatic.org":
                        resourceTimingApiTimes["cloudflare_jscss_net"] = 
                        KAClientTiming.wallTime(staticTimings, cutoff);
                        break;
                    case "fastly.kastatic.org":
                        resourceTimingApiTimes["fastly_jscss_net"] = 
                        KAClientTiming.wallTime(staticTimings, cutoff);
                        break;
                    case "maxcdn.kastatic.org":
                        resourceTimingApiTimes["maxcdn_jscss_net"] = 
                        KAClientTiming.wallTime(staticTimings, cutoff);
                        break;
                    case "www.khanacademy.org":
                        resourceTimingApiTimes["ka_jscss_net"] = 
                        KAClientTiming.wallTime(staticTimings, cutoff);
                        break;
                    default:
                        resourceTimingApiTimes["kastatic_jscss_net"] = 
                        KAClientTiming.wallTime(staticTimings, cutoff);
                        break;}}}




        // We divide our stats into two categories: data that should
        // go to both the eventlog *and* graphite, and data that
        // should go to the event-log only.  In general, we only send
        // data to graphite if we're interested in graphing how the
        // value changes over time.
        var dataToEventLogOnly = {};
        var dataToGraphite = {};


        var stats = Analytics.timingStats;

        dataToGraphite[stats.REDIRECT_MS] = redirectTime;
        dataToGraphite[stats.DNS_MS] = dnsTime;
        dataToGraphite[stats.CONNECT_MS] = connectTime;
        dataToGraphite[stats.REQUEST_MS] = requestTime;
        dataToGraphite[stats.RESPONSE_MS] = responseTime;
        dataToGraphite[stats.DOCUMENT_MS] = documentTime;
        dataToGraphite[stats.CONTENT_LOADED_MS] = contentLoadedTime;
        dataToGraphite[stats.START_TO_CONTENT_LOADED_MS] = readyTime;

        if (resourceTimingApiTimes) {
            dataToGraphite[stats.RESOURCE_NET_MS] = 
            resourceTimingApiTimes["net"];
            dataToGraphite[stats.RESOURCE_MS] = 
            resourceTimingApiTimes["total"];

            if (resourceTimingApiTimes["cloudflare_jscss_net"] != null) {
                dataToGraphite[stats.CLOUDFLARE_JSCSS_NET_MS] = 
                resourceTimingApiTimes["cloudflare_jscss_net"];}

            if (resourceTimingApiTimes["fastly_jscss_net"] != null) {
                dataToGraphite[stats.FASTLY_JSCSS_NET_MS] = 
                resourceTimingApiTimes["fastly_jscss_net"];}

            if (resourceTimingApiTimes["maxcdn_jscss_net"] != null) {
                dataToGraphite[stats.MAXCDN_JSCSS_NET_MS] = 
                resourceTimingApiTimes["maxcdn_jscss_net"];}

            if (resourceTimingApiTimes["ka_jscss_net"] != null) {
                dataToGraphite[stats.KA_JSCSS_NET_MS] = 
                resourceTimingApiTimes["ka_jscss_net"];}

            if (resourceTimingApiTimes["kastatic_jscss_net"] != null) {
                dataToGraphite[stats.KASTATIC_JSCSS_NET_MS] = 
                resourceTimingApiTimes["kastatic_jscss_net"];}}



        return this._postTimings(dataToEventLogOnly, dataToGraphite);}, 


    /**
     * Report a single timing metric to graphite and/or Google Analytics
     * via an app engine endpoint.  Reported metric will be milliseconds
     * since window.performance.timing.navigationStart.
     *
     * @param {string} graphiteTimingName Name of the timing metric.
     *     Should be a value from Analytics.timingStats.  If null,
     *     we will not send this value to graphite.
     * @param {string} gaTimingName Name of the Google Analytics timing
     *     metric.  This should be of the form '<category>.<variable>'.
     *     If null, we will not send this value to Google Analytics.
     *     We will also not send the value to Google Analytics if the
     *     global 'ga' variable is undefined.
     * @returns {Promise} A Promise which resolves when the request to send
     *     data to graphite is finished.
     */
    reportTimingToGraphiteAndGA: function (graphiteTimingName, gaTimingName) {
        var performance = window.performance;
        if (!(performance && (performance.timing || performance.now))) {
            return;}


        var timing = Math.round(
        performance.now ? 
        performance.now() : 
        getNow() - performance.timing.navigationStart);

        if (gaTimingName && typeof ga !== "undefined") {
            if (gaTimingMetricsReported[gaTimingName]) {
                return;}

            gaTimingMetricsReported[gaTimingName] = true;var _gaTimingName$split = 

            gaTimingName.split(".");var category = _gaTimingName$split[0];var variable = _gaTimingName$split[1];
            ga("send", "timing", category, variable, timing);}

        if (graphiteTimingName) {
            // Prevent double-reporting of metrics (eg. if a video is rendered
            // again due to client-side navigation).
            if (graphiteTimingMetricsReported[graphiteTimingName]) {
                return;}

            graphiteTimingMetricsReported[graphiteTimingName] = true;

            var dataToGraphite = {};
            dataToGraphite[graphiteTimingName] = timing;
            return this._postTimings({}, dataToGraphite);} else 
        {
            return new Promise.resolve();}}, 



    /**
     * Tell the analytics framework not to send any timing metrics to
     * graphite and/or Google Analytics with these names.  This is
     * used to protect against client-side navigation.  For instance,
     * if we load a page that does not collect timing stats, and then
     * click on a link that takes us to a new page via client-side
     * navigation (e.g. backbone router) and that new page *does*
     * collect timing stats, then we'll report timing for the new page
     * that includes time spent on the old page.  We can use this
     * function to just turn off timing for both of them, which is
     * throwing away data but better than getting wrong data.
     *
     * @param {string} graphiteTimingName Name of the timing metric.
     *     Should be a value from Analytics.timingStats.  If null,
     *     we will not suppress this parameter.
     * @param {string} gaTimingName Name of the Google Analytics timing
     *     metric.  This should be of the form '<category>.<variable>'.
     *     If null, we will not suppress this parameter.
     */
    suppressTimingToGraphiteAndGA: function (graphiteTimingName, gaTimingName) {
        // We just fake that we reported some numbers for these stats;
        // that will suppress sending any future info using these stats.
        if (graphiteTimingName) {
            graphiteTimingMetricsReported[graphiteTimingName] = true;}

        if (gaTimingName) {
            gaTimingMetricsReported[gaTimingName] = true;}}, 



    /**
     * Send AJAX request to our app engine endpoint on timing metrics.
     *
     * @param {object} dataToEventLogOnly Map of metric key to milliseconds for
     *     given metric.
     * @param {object} dataToGraphite Map of graphite metric key to
     *     milliseconds for given metric.
     * @param {object} dataToGA Map of graphite metric key to
     *     milliseconds for given metric.
     * @returns {Promise} A promise which resolves when the timing request is
     *     finished.
     */
    _postTimings: function (dataToEventLogOnly, dataToGraphite) {
        // /_mt/ puts this on a multithreaded module, which is slower
        // but cheaper.  We don't care how long this takes, so it's a
        // good choice for us!
        return khanFetch("/api/internal/_mt/elog", { 
            method: "POST", 
            body: formUrlencode(babelHelpers._extends({}, 
            dataToEventLogOnly, 
            dataToGraphite, { 
                _request_id: KA.requestLogId, 
                _graphite_key_prefix: KA.gaeStatsKeyPrefix, 
                _graphite_keys: Object.keys(dataToGraphite).join() })) });} };





module.exports = Analytics;
});
KAdefine("javascript/shared-package/ka-client-timing.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/*
 * This object has functions to report custom performance timings,
 * i.e., time spent running KA JS packages, and time spent downloading
 * JS and CSS.
 *
 * It creates and process "timing" objects with the keys:
 *   name: An identifier, e.g., name of the package, URL of a resource.
 *   startTime: Start of event as UNIX timestamp.
 *   endTime: End of event as UNIX timestamp.
 */
var KAClientTiming = { 
    /**
     * True if the client supports the Resource Timing API.
     * @return {boolean}
     */
    clientHasResourceTimingAPI: function () {
        return Boolean(window.performance && 
        typeof window.performance.getEntriesByType === "function");}, 


    /**
     * Return array of timing objects for Resource Timing API entries.
     *
     * The "name" key is resolved URL returned by the Resource Timing API.
     *
     * @param {regexp} nameRegexp Return entries with a matching "name" key.
     */
    getResourceEntries: function (nameRegexp) {
        // Oddly, window.performance.getEntriesByType is sometimes not
        // a function, see http://calendar.perfplanet.com/2012/an-introduction-to-the-resource-timing-api/
        if (!this.clientHasResourceTimingAPI() || !window.performance.timing) {
            return [];}


        // Filter to matching URLs (confusingly stored as "name"), see
        // http://www.w3.org/TR/resource-timing/#performanceresourcetiming
        var resourceTimings = window.performance.getEntriesByType("resource");
        if (nameRegexp) {
            resourceTimings = resourceTimings.
            filter(function (t) {return nameRegexp.test(t.name);});}


        // Convert to absolute start and end times.
        var navigationStart = window.performance.timing.navigationStart;
        return resourceTimings.map(function (t) {return { 
                name: t.name, 
                startTime: navigationStart + t.startTime, 
                endTime: navigationStart + t.startTime + t.duration };});}, 



    /**
     * Return the non-overlapping "wall clock" time that has passed.
     *
     * For example, CSS and JS resources might load in parallel, so
     * the download times may overlap. This function returns a sum
     * that doesn't double-count overlapping time blocks.
     *
     * @param {array} timings Timing objects.
     * @param {number} cutoffTime Timing objects that start or end
     *     after this point in time are ignored. It's value is a
     *     time in milliseconds since the UNIX epoch.
     * @return {integer} Time in milliseconds.
     */
    wallTime: function (timings, cutoffTime) {
        cutoffTime = cutoffTime || Number.MAX_VALUE;
        timings = (timings || []).sort(function (a, b) {return a.startTime - b.startTime;});
        var totalTime = 0;
        var currentStartTime = 0;
        var currentEndTime = 0;
        timings.forEach(function (t) {
            var startTime = t.startTime;
            var endTime = t.endTime;
            if (endTime > cutoffTime) {
                return;}

            if (startTime <= currentEndTime) {
                // Possibly expand the current block.
                currentEndTime = Math.max(currentEndTime, endTime);} else 
            {
                // Begin a new non-overlapping block.
                totalTime += currentEndTime - currentStartTime;
                currentStartTime = startTime;
                currentEndTime = endTime;}});


        totalTime += currentEndTime - currentStartTime;
        return Math.round(totalTime);} };



module.exports = KAClientTiming;
});
KAdefine("javascript/shared-package/notifications-loader.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, no-unused-vars, one-var */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Minimal bootstrapping code to load notifications when a notification or its
 * dropdown is being displayed.
 */

var $ = require("jquery");

var updateDocumentTitle = require("./update-document-title.js");

var load = function (cb) {
    require.async([
    "../notifications-package/notifications.js", 
    "package!notifications.css"], 
    cb);};


var NotificationsLoader = { 

    _loaded: false, 

    /**
     * Hook up events to start loading notifications when necessary.
     */
    init: function () {
        // Load whenever the notifications icon is hovered (which causes the
        // notifications dropdown to be displayed).
        $("#user-info").
        on("open", "#user-notifications", function (e) {
            // Start loading notifications as soon as the dropdown is
            // opened.
            NotificationsLoader.load();

            // Immediately clear the count of brand new notifications once
            // the notifications dropdown is displayed, regardless of
            // whether or not notifications.js resources have finished
            // loading.
            NotificationsLoader.clearBrandNewCount();}).

        on("click", ".user-notifications-toggle", function (e) {
            // Don't hide the notification dropdown when the notifications
            // icon is clicked. Completely cancel the event for now.
            // TODO(kamens): remove this when athena UI is served to 100%
            // of users.
            return false;});}, 



    /**
     * Require the necessary notifications resources and return their promise.
     */
    /**
     * Load necessary resources, then fetch and render notifications.
     */
    load: function () {
        if (this._loaded) {
            return;}

        load(function (Notifications) {
            Notifications.load();});

        this._loaded = true;}, 


    /**
     * Load notifications sent back as the result of any API request.
     */
    loadFromAPI: function (notificationDict) {
        load(function (Notifications) {
            var readable = notificationDict["readable"], 
            urgent = notificationDict["urgent"], 
            continueUrl = notificationDict["continueUrl"];

            if (readable.length) {
                Notifications.renderFromAPI(readable);
                NotificationsLoader.incrementBrandNewCount(readable.length);}


            if (urgent.length) {
                Notifications.renderUrgent(urgent[0], continueUrl);}});}, 




    /**
     * Load necessary resources and then render an urgent notification.
     */
    loadUrgent: function (urgentNotification, continueUrl) {
        load(function (Notifications) {
            Notifications.renderUrgent(urgentNotification, continueUrl);});}, 



    /**
     * Clear and reset the bubble that shows how many new notifications are
     * waiting. Send a request to the server to clear the count for the current
     * user.
     */
    clearBrandNewCount: function () {
        var $el = $(".notification-bubble");
        if (parseInt($el.text()) !== 0) {
            // Immediately update the UI's count of notifications...
            $(".notification-bubble").
            text("0").
            hide().
            parents(".icon").
            removeClass("brand-new");

            updateDocumentTitle({ noteCount: 0 });

            // ...and then send the ajax request.
            load(function (Notifications) {
                Notifications.clearBrandNewCount();});}}, 




    /**
     * Increment the bubble count that shows how many new notifications are
     * waiting.
     */
    incrementBrandNewCount: function (n) {
        var $el = $(".notification-bubble");
        var count = parseInt($el.text()) + n;
        $el.
        text(count).
        show().
        parents(".icon-bell-alt").
        addClass("brand-new");

        updateDocumentTitle({ noteCount: count });} };



module.exports = NotificationsLoader;
});
KAdefine("javascript/shared-package/issue-loader.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, no-unused-vars */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Minimal bootstrapping code to load issue modals when someone clicks on a
 * button to report an issue.
 */

var $ = require("jquery");

var IssueLoader = { 
    /**
     * Hook up events to start loading issue modals when necessary.
     */
    init: function () {
        // Load whenever an issueLoader class is hovered over
        $(".issueLoader").
        on("mouseover", function (e) {
            // Preload to make life faster when they actually click.
            require.async(["../issues-package/issues.jsx", 
            "package!issues.css"]);});


        // open the modal whenever a .report_issue class is clicked
        $(".report-issue").
        on("click", function (e) {
            // Start loading notifications as soon as the dropdown is
            // opened.
            IssueLoader.load(e);
            return false;});}, 



    /**
     * Load necessary resources, then fetch and render report issue modal.
     */
    load: function (e) {
        require.async([
        "../issues-package/issues.jsx", 
        "package!issues.css"], 
        function (Issues) {
            var toggleReportIssueModal = Issues.toggleReportIssueModal;
            toggleReportIssueModal($(e.target).data("report-type"));});} };




module.exports = IssueLoader;
});
KAdefine("javascript/shared-package/typeahead-loader.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * @fileoverview Prefetches typeahead search, like in the top nav of the page.
 *
 * TODO(benkomalo): this isn't super useful anymore since it's a remnant of
 * a legacy typeahead implementation that was jQuery/bootstrap based and did
 * magic of finding all elements on a page and adding functionality to them.
 * The new typeahead is React based and components created in a much more
 * explicit fashion so there's not much value in this unless we set up
 * a similar system where the React component can replace an existing input.
 */

var KA = require("./ka.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;

var suggestionsDeferred = null; // deferred for loading suggestion index

var requireSuggestions = function () {
    if (!suggestionsDeferred) {
        var suggestionsUrl = "/api/internal/search/suggestions_index?v=1";
        suggestionsDeferred = khanFetch(suggestionsUrl);}

    return suggestionsDeferred;};


var loadJavaScript = function () {
    // Optimistically load the files needed by renderSearchBox in nav-header.js.
    require.async([
    "../typeahead-package/search-box.jsx", 
    "../typeahead-package/build-mission-source.js", 
    "package!typeahead.css"], 
    function () {});};


var init = function () {
    if (!KA.INITIALIZED) {
        // HACK: on some micro pages (e.g. the login form iframe) we don't
        // load the full page, and all sorts of init code that references this
        // hacky global KA thing breaks. Just don't run the init code -  we
        // don't need it.
        return;}


    var resolve = undefined;
    setTimeout(function () {
        loadJavaScript();
        resolve(requireSuggestions());}, 
    2000);
    return new Promise(function (res, rej) {return resolve = res;});};


module.exports = { 
    init: init };
});
KAdefine("javascript/shared-package/api-action-results.js", function(require, module, exports) {
/**
 * Hello friend! APIActionResults is an observer for all requests that go
 * through the page.
 *
 * It will listens for requests with the magic header "X-KA-API-Response" which
 * is added in from api/route_decorator.py:add_api_header(). In
 * api/internal/user.py, add_action_results takes care of bundling data to be
 * digested by this client-side listener.
 *
 * When this header is found, this file looks at the data in the request for
 * the actions contained within the request, and calls the handler that
 * registered for that specific request.
 *
 * This file also adds some magic URL parameters and headers to outbound
 * requests. In particular, it adds XSRF headers, a cachebusting parameter, and
 * a language parameter.
 */
var $ = require("jquery");
var Cookies = require("./cookies.js");
var KA = require("./ka.js");
var NotificationsLoader = require("./notifications-loader.js");

var APIActionResults = { 
    init: function () {
        this.hooks = [];
        APIActionResults.addJQueryHooks();}, 


    /**
     * Add hooks to jQuery's ajax function to handle adding the
     * parameters/headers to requests and inspecting the results for API action
     * headers.
     */
    addJQueryHooks: function () {
        $(document).ajaxComplete(function (e, xhr, settings) {
            if (!xhr) {
                return;}


            // Check for API version mismatches
            // TODO(emily): This doesn't have to do with API action
            // results, and should be moved somewhere else.
            APIActionResults.checkApiVersionMismatch(
            function (header) {return xhr.getResponseHeader(header);});

            // Check the response for API actions
            APIActionResults.checkApiResponse(
            xhr.responseText, 
            function (header) {return xhr.getResponseHeader(header);});});


        $.ajaxSetup({ 
            beforeSend: function (xhr, settings) {
                // Add the language parameter.
                // TODO(emily): This doesn't have to do with API action
                // results, and should be moved somewhere else.
                if (KA.language && settings && settings.url) {
                    settings.url = APIActionResults.addLangParam(
                    settings.url, KA.language);}


                if (settings && settings.url) {
                    // Add the cache parameter.
                    //
                    // Note: We are adding this here instead of setting the
                    // cache parameter in ajaxSetup because that would affect
                    // all urls not just api urls.
                    //
                    // Another Note: We are not doing setting.cache=false here
                    // because jquery adds the cache busting parameter before
                    // executing beforeSend.
                    //
                    // Warning: if we ever get rid of calling func =
                    // add_no_cache_header(func) by default in
                    // api/route_decorator.py and make sure we should remove
                    // this and make sure cache: false is set on all
                    // non-cacheable api ajax calls, otherwise Chrome will use
                    // the browser cache for ajax requests that happen on page
                    // load if we arrived at the page from the back button
                    // regardless of response header settings.
                    //
                    // TODO(emily): This doesn't have to do with API action
                    // results, and should be moved somewhere else.
                    if (settings.cache === undefined) {
                        settings.url = APIActionResults.addCacheParam(
                        settings.url);}


                    // Adds the XSRF key to the request.
                    // TODO(emily): This doesn't have to do with API action
                    // results, and should be moved somewhere else.
                    var succeeded = APIActionResults.addXsrfKey(
                    settings.url, 
                    function (name, value) {return xhr.setRequestHeader(name, value);});
                    if (!succeeded) {
                        // If adding the xsrf key failed, attempt to trigger
                        // the error callback and cancel the request by
                        // returning false.
                        settings.error && settings.error();
                        return false;}}} });}, 






    /**
     * Add a lang=<language> param for all khan-academy calls if it does not
     * already have the parameter set. TODO(csilvers): figure out what other
     * routes js can call.
     * TODO(kamens): some of our one-off pages that don't inherit from our
     * standard template (e.g. /stories) need to make API calls even though the
     * global KA object (and therefore KA.language) isn't defined. In these
     * cases we assume the language should be english and don't send a lang=
     * param. We may want to log this case in the future or make all top-level
     * templates define the global KA object.
     *
     * TODO(emily): This doesn't have anything to do with API action results,
     * and should probably be moved somewhere else.
     *
     * Arguments:
     *   url: the URL of the request
     *   lang: the current language
     * Returns:
     *   The url, maybe with a lang= parameter added
     */
    addLangParam: function (url, lang) {
        if (!/[?&]lang=/.test(url) && (
        url.indexOf("/api/") > -1 || 
        url.indexOf("/profile/graph") > -1 || 
        url.indexOf("/goals/new") > -1 || 
        url.indexOf("/khan-exercises/exercises/") > -1)) {
            return url + (/\?/.test(url) ? "&" : "?") + 
            "lang=" + lang;}

        return url;}, 


    /**
     * Add anti-cache parameter in url by default for all api calls, unless
     * they have the default 'v' parameter of cacheable in api/decorators.py or
     * if the cache parameter is already set.
     *
     * TODO(emily): This doesn't have anything to do with API action results,
     * and should probably be moved somewhere else.
     *
     * Arguments:
     *    url: the URL of the request
     * Returns:
     *    The url, maybe with a caching parameter added
     */
    addCacheParam: function (url) {
        if (url.indexOf("/api/") > -1) {
            if (!/[\?&]v=/.test(url)) {
                // This code is adapted from jquery.js
                var ts = +new Date();
                // try replacing _= if it is there
                var ret = url.replace(/([?&])_=[^&]*/, "$1_=" + ts);

                // if nothing was replaced, add timestamp to the end
                return ret + (
                ret === url ? 
                (/\?/.test(url) ? "&" : "?") + "_=" + ts : 
                "");}}


        return url;}, 


    /**
     * Send XSRF token in the request via header so it can be matched up w/
     * cookie value.
     *
     * TODO(emily): This doesn't have anything to do with API action results,
     * and should probably be moved somewhere else.
     *
     * Arguments:
     *    url: the URL of the request
     *    setHeaderCallback: a function which takes name and value arguments
     *                       and sets the given header in the current request.
     * Returns:
     *    A boolean, where true indicates success and false indicates failure,
     *    when the XSRF cookie couldn't be found and the request should be
     *    aborted.
     */
    addXsrfKey: function (url, setHeaderCallback) {
        if (url.indexOf("/api/") > -1) {
            var xsrfToken = Cookies.readCookie("fkey");
            if (xsrfToken) {
                setHeaderCallback("X-KA-FKey", xsrfToken);
                return true;} else 
            {
                APIActionResults._apiVersionMismatch();
                return false;}}


        return true;}, 


    /**
     * Checks a response for the version mismatch header, and reports an error
     * if it is found.
     *
     * Arguments:
     *    getHeaderCallback: a function that takes a header name argument and
     *                       returns the value of that header in the response.
     */
    checkApiVersionMismatch: function (getHeaderCallback) {
        if (getHeaderCallback("X-KA-API-Version-Mismatch")) {
            APIActionResults._apiVersionMismatch();}}, 



    /**
     * Checks a response for API response actions, and responds to those
     * actions appropriately.
     *
     * Arguments:
     *    responseBody: the textual body of the request.
     *    getHeaderCallback: a function that takes a header name argument and
     *                       returns the value of that header in the response.
     */
    checkApiResponse: function (responseBody, getHeaderCallback) {
        if (getHeaderCallback("X-KA-API-Response") && responseBody) {
            if (responseBody.indexOf("action_results") === -1 && 
            responseBody.indexOf("actionResults") === -1) {
                // We can skip spending any time evaluating the response
                // if action results clearly aren't anywhere in the result.
                return;}


            var result;
            try {
                // TODO(emily): Can this safely be turned into `var result =
                // JSON.parse(responseBody);`?
                eval("result = " + responseBody);} 
            catch (err) {
                return;}


            if (result) {
                // Result format may differ depending on if 'casing=camel'
                // was provided in the request.
                var action = result["action_results"] || 
                result["actionResults"];
                if (action) {
                    APIActionResults.respondToAction(action);}}}}, 





    /**
     * Converts our Python code's underscore_variable_notation to camelCase
     *
     * TODO: can remove when all of our API calls use casing:camel, see
     * APIActionResults.register above.
     */
    toCamelCase: function (prop) {
        // From http://stackoverflow.com/questions/6660977/convert-hyphens-to-camel-case-camelcase
        return prop.replace(/_([a-z])/g, function (match, ch) {
            return ch.toUpperCase();});}, 



    respondToAction: function (action) {
        $(APIActionResults.hooks).each(function (ix, el) {
            if (typeof action[el.prop] !== "undefined") {
                el.fxn(action[el.prop]);}});}, 




    /**
     * Reports that there is a mismatch in API versions.
     */
    _apiVersionMismatch: function () {
        // Tell the notifications loader to render an urgent
        // "ApiVersionMismatch" notification.
        NotificationsLoader.loadUrgent({ 
            class_: ["ApiVersionMismatchNotification"] });}, 



    /**
     * Register both prop and the camelCase version of prop as an API event
     * listener.
     *
     * TODO: when all of our API calls use casing:camel, we won't need
     * toCamelCase because everything will register with APIActionResults using
     * the camelCased variable name.
     */
    register: function (prop, fxn) {
        this.hooks[this.hooks.length] = { prop: prop, fxn: fxn };
        this.hooks[this.hooks.length] = { 
            prop: APIActionResults.toCamelCase(prop), 
            fxn: fxn };}, 



    addDefaultHooks: function () {
        if (window.ScratchpadUI && // @Nolint(emily)
        ScratchpadUI.trusted && // @Nolint(emily): we need to access this
        // globally here to check if it exists.
        window !== top) {
            // Do not register action results on an embedded scratchpad -- they
            // will be passed up to the parent frame in ajaxComplete.
            return;}

        APIActionResults.register(
        "notifications_added", 
        NotificationsLoader.loadFromAPI.bind(NotificationsLoader));

        APIActionResults.register("user_profile", function (profile) {
            // Hack -- basically, the scratchpad API does not convert
            // underscored_properties to camelCase, but user_profile expects
            // camelCase when it parses out the Backbone UserProfile. The
            // problem manifests as a false isAccessible but true is_accessible
            // on the UserProfile object, which breaks the phantom user hover
            // card content when talkies are initially viewed after logging out
            // to create a new phantom user. But, this only causes problems on
            // embedded scratchpads and happens to "work" on non-embedded
            // scratchpads simply because "points" is the same attribute name
            // in both underscore land and camel case land, and the scratchpad
            // handler creates a pre_phantom user for every user -- since the
            // Jinja template renderer checks this "user" property to be
            // non-null, it then creates a UserProfile for the pre-phantom,
            // with points set to 0. To fix everything momentarily, here we
            // manually convert the user_profile JSON to camelCase. TODO
            // (sophia/joel/john): Go through the CS scratchpad code and have
            // the API return camelCased properties, or use a more robust
            // workaround. Also investigate the necessity of having a
            // pre_phantom user, which causes the jinja template renderer to
            // create a UserProfile for the pre_phantom and populate it with
            // the defaults.
            var newProfile = {};
            for (var attr in profile) {
                if (profile.hasOwnProperty(attr)) {
                    newProfile[APIActionResults.toCamelCase(attr)] = 
                    profile[attr];}}


            profile = newProfile;

            KA.setUserProfile(profile);

            var NavHeader = require("../shared-package/nav-header.js");
            // If we just converted from no user to a phantom, we swap out the
            // sign up button for a user dropdown that says "Unclaimed points".
            // TODO(marcia): understand coach demo overwriting of profile root
            NavHeader.renderUserDropdown();
            NavHeader.renderNotificationsDropdown();});} };




module.exports = APIActionResults;
});
KAdefine("javascript/shared-package/facebookutil.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-unused-vars, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Utilities for interacting with Facebook and its JS SDK.
 */

require("../../third_party/javascript-khansrc/jqueryui/jquery.ui.effect.js");
var $ = require("jquery");
var icu = require("icu");

var Analytics = require("../shared-package/analytics.js");
var Cookies = require("./cookies.js");
var KA = require("./ka.js");
var LocalStore = require("./local-store.js");

var resolveReady = null;

var FacebookUtil = { 

    init: function () {
        if (!KA.FB_APP_ID) {
            return;}


        window.fbAsyncInit = function () {
            FB.init({ 
                version: "v2.0", 
                appId: KA.FB_APP_ID, 
                status: false, // Fetch status conditionally below.
                cookie: true, 
                xfbml: true, 
                oauth: true });


            if (FacebookUtil.isUsingFbLogin()) {
                // Only retrieve the status if the user has opted to log in
                // with Facebook
                FB.getLoginStatus(function (response) {
                    if (response.authResponse) {
                        FacebookUtil.fixMissingCookie(response.authResponse);} else 
                    {
                        // The user is no longer signed into Facebook - must
                        // have logged out of FB in another window or disconnected
                        // the service in their FB settings page.
                        Cookies.eraseCookie("fbl");}});}




            // auth.login is fired when the auth status changes to "connected"
            FB.Event.subscribe("auth.login", function (response) {
                FacebookUtil.setFacebookID(response.authResponse.userID);});


            // Set a callback to show the div containing the Facepile iframe
            // only if Facepile actually renders with friend images inside
            FB.Event.subscribe("xfbml.render", function (response) {
                var $facepile = $("#facepile-holder");

                // Eugh, this is gross to hardcode but the Facepile iframe
                // still takes up space even when it doesn't render with
                // content inside (the user is not logged into FB or doesn't
                // have friends who've logged into KA with FB), so we must
                // resort to this technique for detecting if there's actually
                // content in the iframe
                // TODO(stephanie): only do the hack when we know the user is
                // logged into FB
                var facepileNotLoadedHeight = 22;

                // Multiply by some amount to be safe. We'd rather miss out on
                // showing Facepile than showing a weird empty white box above
                // the signin buttons.
                if ($facepile.height() <= facepileNotLoadedHeight * 1.5) {
                    // Make sure the facepile iframe is not tabbable
                    $facepile.find("iframe").attr("tabindex", -1);
                    return;}


                $facepile.animate({ 
                    opacity: 1, 
                    duration: 200, 
                    easing: "easeInOutCubic" });


                Analytics.trackSingleEvent("Load Facepile");});


            // Resolve an existing Promise, if it was already created
            if (resolveReady) {
                resolveReady();}


            // Create a new resolved Promise for the future
            FacebookUtil._fbReadyPromise = Promise.resolve();};


        // We register clicks on the #user-info, since the #page_logout
        // element may be rendered by the client and mucked with. Since
        // this is only run once on page init, we play it conservatively
        // and listen to an element that's always there and unchanging.
        $("#user-info").on("click", "#page_logout", function (e) {
            var hostname = window.location.hostname;

            // By convention, dev servers lead with "local." in the address
            // even though the domain registered with FB is without it.
            if (hostname.indexOf("local.") === 0) {
                hostname = hostname.substring(6);}


            var shouldLogOutOfFb = FacebookUtil.isUsingFbLogin();

            // The Facebook cookies are set on ".www.khanacademy.org",
            // though older ones are not. Clear both to be safe.
            Cookies.eraseCookie("fbsr_" + KA.FB_APP_ID);
            Cookies.eraseCookie("fbsr_" + KA.FB_APP_ID, "." + hostname);
            Cookies.eraseCookie("fbm_" + KA.FB_APP_ID);
            Cookies.eraseCookie("fbm_" + KA.FB_APP_ID, "." + hostname);
            Cookies.eraseCookie("fbl");

            if (shouldLogOutOfFb) {
                // If the user used FB to log in, log them out of FB, too.
                try {
                    FB.logout(function () {
                        window.location = $("#page_logout").attr("href");});

                    return false;} 
                catch (err) {
                    // FB.logout can throw if the user isn't actually
                    // signed into FB. We can get into this state
                    // in a few odd ways (if they re-sign in using Google,
                    // then sign out of FB in a separate tab).
                    // Just ignore it, and have logout work as normal.
                    window.location = $("#page_logout").attr("href");}}});




        if (FacebookUtil.isUsingFbLogin()) {
            // For now, let's load the Facebook JS on every page but only when
            // a Facebook user is logged in. Still better than loading it on
            // every page for all users. (Getting logout to work properly while
            // loading the JS async seems to be painful.)
            FacebookUtil.loadFb();}}, 



    fbLoadStarted_: false, 
    loadFb: function () {
        if (this.fbLoadStarted_) {
            return;}


        this.fbLoadStarted_ = true;
        var e = document.createElement("script");
        // TODO(csilvers): I18N: 'extend' locale to include country (es->es-ES)
        e.src = document.location.protocol + "//connect.facebook.net/" + 
        icu.getLocale().replace(/-/g, "_") + "/sdk.js";

        var fbRoot = document.getElementById("fb-root");
        if (fbRoot) {
            fbRoot.appendChild(e);}}, 



    _fbReadyPromise: new Promise(function (resolve) {
        resolveReady = resolve;}), 

    runOnFbReady: function (func) {
        this.loadFb();
        this._fbReadyPromise.then(func);}, 


    isUsingFbLoginCached_: undefined, 

    /**
     * Facebook User ID of current logged-in Facebook user. Set by FB.Event
     * subscription to 'auth.login'.
     */
    facebookID: undefined, 

    getFacebookID: function () {
        if (KA.getUserProfile() && FacebookUtil.isUsingFbLogin()) {
            return FacebookUtil.facebookID || LocalStore.get("facebookID");}

        return null;}, 


    setFacebookID: function (facebookID) {
        FacebookUtil.facebookID = facebookID;
        LocalStore.set("facebookID", facebookID);}, 


    /**
     * Whether or not the user has opted to sign in to Khan Academy
     * using Facebook.
     */
    isUsingFbLogin: function () {
        if (FacebookUtil.isUsingFbLoginCached_ === undefined) {
            FacebookUtil.isUsingFbLoginCached_ = !!Cookies.readCookie("fbl");}

        return FacebookUtil.isUsingFbLoginCached_;}, 


    /**
     * Indicates that the user has opted to sign in to Khan Academy
     * using Facebook.
     */
    markUsingFbLogin: function () {
        // Generously give 30 days to the fbl cookie, which indicates
        // that the user is using FB to log in.
        Cookies.createCookie("fbl", true, 30);}, 


    /**
     * Use LocalStore to record that the user has given us the "publish_stream"
     * permission on Facebook.
     * @param {boolean} permissionGranted
     */
    setPublishStreamPermission: function (permissionGranted) {
        var data = LocalStore.get("fbPublishStream");
        if (!data) {
            // we're storing data as an object instead of an array for easy
            // lookups
            data = {};}

        var facebookID = FacebookUtil.getFacebookID();
        if (facebookID) {
            if (permissionGranted) {
                data[facebookID] = true;} else 
            {
                delete data[facebookID];}

            LocalStore.set("fbPublishStream", data);}}, 



    /**
     * Returns true if the LocalStore indicates the user has given us the
     * "publish_stream" permission on Facebook.
     */
    hasPublishStreamPermission: function () {
        var data = LocalStore.get("fbPublishStream");
        if (data && data[FacebookUtil.getFacebookID()]) {
            return true;}

        return false;}, 


    fixMissingCookie: function (authResponse) {
        // In certain circumstances, Facebook's JS SDK fails to set their cookie
        // but still thinks users are logged in. To avoid continuous reloads, we
        // set the cookie manually. See http://forum.developers.facebook.net/viewtopic.php?id=67438.

        if (Cookies.readCookie("fbsr_" + KA.FB_APP_ID)) {
            return;}


        if (authResponse && authResponse.signedRequest) {
            // Explicitly use a session cookie here for IE's sake.
            Cookies.createCookie("fbsr_" + KA.FB_APP_ID, authResponse.signedRequest);}} };




module.exports = FacebookUtil;
});
KAdefine("javascript/shared-package/social.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, indent, max-len, one-var, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var $ = require("jquery");

var i18n = require("./i18n.js");
var FacebookUtil = require("./facebookutil.js");

var Social = { 
    init: function () {
        /** We're using a custom Twitter button, this code enables a popup */
        $("body").on("click", ".twitterShare", function () {
            Social.openTwitterPopup(this.href);
            return false;});}, 



    /* Any view that calls facebookVideo should try to call this
     function before, like on a mouseover event, so that FB
     is loaded before they actually try to share. Otherwise,
     users will see a pop-up blocker.
    */
    prepFacebook: function () {
        FacebookUtil.runOnFbReady(function () {});}, 


    facebookShare: function (name, url, image) {
        FacebookUtil.runOnFbReady(function () {
            FB.ui({ 
                method: "feed", 
                name: name, 
                link: url, 
                picture: image, 
                caption: "www.khanacademy.org" });});


        return false;}, 


    /** Publish a standard "post" action to user's Facebook Timeline */
    facebookVideo: function (name, desc, url) {

        FacebookUtil.runOnFbReady(function () {
            FB.ui({ 
                method: "feed", 
                name: name, 
                link: "http://www.khanacademy.org/" + url, 
                picture: "http://www.khanacademy.org/images/handtreehorizontal_facebook.png", 
                caption: "www.khanacademy.org", 
                description: desc, 
                message: i18n._("I just learned about %(title)s on Khan Academy", { 
                    title: name }) });});



        return false;}, 



    /**
     * Format a mailto: url for sending an email with the provided subject and
     * body.
     *
     * Example usage:
     *
     *      var emailUrl = Social.formatMailtoUrl({
     *          subject: "Check out all this awesome on Khan Academy!",
     *          body: "Check it out at http://www.khanacademy.org."
     *      });
     */
    formatMailtoUrl: function (options) {
        var subject = options.subject;
        var body = options.body;

        var href = "mailto:" + 
        "?Subject=" + encodeURIComponent(subject) + 
        "&Body=" + encodeURIComponent(body);

        return href.replace(/\s/g, "+");}, 


    emailBadge: function (url, desc) {
        return Social.formatMailtoUrl({ 
            subject: i18n._("I just earned the %(badge)s badge on Khan Academy!", 
            { badge: desc }), 
            body: i18n._("Check it out at %(url)s.", { url: url }) });}, 



    /**
     * Open a popup window centered in the screen with the specified url.
     * To be used for opening a popup for tweeting.
     */
    openTwitterPopup: function (url) {
        var width = 550, 
        height = 370, 
        left = ($(window).width() - width) / 2, 
        top = ($(window).height() - height) / 2, 
        opts = "status=1" + 
        ",width=" + width + 
        ",height=" + height + 
        ",top=" + top + 
        ",left=" + left;
        window.open(url, "twitter", opts);}, 


    /**
     * Format a twitter URL for sharing the specified url with the specified
     * text.
     *
     * Example usage:
     *
     *      var twitterUrl = Social.formatTwitterShareUrl({
     *          url: "http://www.khanacademy.org/computer-programming",
     *          text: "Check out these explorations on Khan Academy!"
     *      });
     */
    formatTwitterShareUrl: function (options) {
        var url = options.url;
        var text = options.text;

        var href = "http://twitter.com/intent/tweet?" + 
        "url=" + encodeURIComponent(url) + 
        "&text=" + encodeURIComponent(text) + 
        "&related=khanacademy:Khan Academy";

        return href.replace(/\s/g, "+");}, 


    twitterBadge: function (url, desc) {
        return Social.formatTwitterShareUrl({ 
            url: url, 
            text: i18n._("I just earned the %(badge)s badge on @khanacademy! Check it out at", 
            { badge: desc }) });} };




module.exports = Social;
});
KAdefine("javascript/shared-package/promos.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * JS client library for detecting if a user has been served a
 * one-time promotion of any kind.
 *
 * Corresponds to PromoRecord in promo_record_model.py on the server side.
 */var _require = 

require("./khan-fetch.js");var khanFetch = _require.khanFetch;

var Promos = {};

// TODO: use localstorage?
/**
 * Cache of promo data.
 */
Promos.cache_ = {};


/**
 * Asynchronously checks to see if a user has been served a
 * particular promo.
 * @param {string} promoName The name of the promo to check.
 * @param {Function} callback A callback that accepts a single boolean
 *     indicating whether or not the user has seen the promo.
 * @param {Object} context Optional 'this' context to invoke the callback with.
 */
Promos.hasUserSeen = function (promoName, callback, context) {
    if (promoName in Promos.cache_) {
        callback.call(context, Promos.cache_[promoName]);
        return;}


    khanFetch("/api/internal/user/promo/" + encodeURIComponent(promoName)).
    then(function (resp) {return resp.json();}).
    then(
    function (hasSeen) {
        Promos.cache_[promoName] = hasSeen;
        callback.call(context, hasSeen);}, 

    function () {
        // Err on the side of safety and avoid showing promos when
        // connectivity is flaky?
        callback.call(context, true);});};




/**
 * Marks a promo as having been served.
 */
Promos.markAsSeen = function (promoName) {
    Promos.cache_[promoName] = true;
    return khanFetch(
    "/api/internal/user/promo/" + encodeURIComponent(promoName), 
    { 
        method: "POST" });};



module.exports = Promos;
});
KAdefine("javascript/shared-package/bigbingo.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable camelcase, comma-dangle, indent, no-trailing-spaces, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */var _require = 


require("./khan-fetch.js");var khanFetch = _require.khanFetch;var formUrlencode = _require.formUrlencode;

var BigBingo = { 
    /**
     * Mark an array of conversions as having happened for the current user.
     *
     * @param {string[]} conversionIds An array of strings, each of which
     *     should be a conversion ID listed in _SOURCE_CONVERSIONS in
     *     bigbingo/config.py.
     * @return {jqXHR} the jquery promise xhr object
     */
    markConversions: function (conversionIds) {
        // /_mt/ puts this on a multithreaded module, which is slower
        // but cheaper.  We don't care how long this takes, so it's
        // a good choice for us!
        return khanFetch("/api/internal/_mt/bigbingo/mark_conversions", { 
            method: "POST", 
            body: formUrlencode({ 
                conversion_ids: conversionIds.join(",") }) });}, 



    /**
     * Mark an array of conversions as having happened for the current user.
     *
     * @param {{id: string, extra: Object}[]} conversions An array of objects
     *     with two properties. `id` should be a conversion ID listed in
     *     _SOURCE_CONVERSIONS in bigbingo/config.py. `extra` should be a
     *     simple object containing additional details that will be
     *     json-encoded and sent to BigQuery.
     * @return {jqXHR} the jquery promise xhr object
     */
    markConversionsWithExtras: function (conversions) {
        return khanFetch("/api/internal/_mt/bigbingo/mark_conversions", { 
            method: "POST", 
            body: formUrlencode({ 
                conversions: JSON.stringify(conversions) }) });}, 




    /**
     * Mark an array of conversions as having happened for the current user.
     * @param {string} topic_slug slug for extracting product annotations
     * @param {{id: string, extra: Object}[]} conversions An array of objects
     *     with two properties. `id` should be a conversion ID listed in
     *     _SOURCE_CONVERSIONS in bigbingo/config.py. `extra` should be a
     *     simple object containing additional details that will be
     *     json-encoded and sent to BigQuery.
     * @return {jqXHR} the jquery promise xhr object
     */

    markConversionsWithProduct: function (topic_slug, conversions) {
        var url = "/api/internal/_mt/bigbingo/mark_conversions_with_product" + 
        "?topic_slug=" + encodeURIComponent(topic_slug);
        return khanFetch(url, { 
            method: "POST", 
            body: JSON.stringify({ "conversions": conversions }), 
            headers: { 
                "Content-Type": "application/json" } });}, 



    /**
     * Mark a single conversion as having happened for the current user.
     *
     * @param {string} conversionId The identifier string for a conversion,
     *     which should be listed in _SOURCE_CONVERSIONS in bigbingo/config.py.
     * @param {Object} [conversionExtra] An optional simple object containing
     *     additional details that will be json-encoded and sent to BigQuery.
     * @return {jqXHR} the jquery promise xhr object
     */
    markConversion: function (conversionId, conversionExtra) {
        if (conversionExtra) {
            return this.markConversionsWithExtras([{ 
                id: conversionId, 
                extra: conversionExtra }]);} else 

        {
            return this.markConversions([conversionId]);}}, 



    /**
     * Participate the current user in the given experiment.
     *
     * @param {string} experimentId The string name of the experiment's id.
     * @return {Promise} A Promise that resolves to the A/B test data.
     */
    abTest: function (experimentId) {
        // TODO(marcia): camelCase experiment_id below and conversion_ids above
        return khanFetch("/api/internal/bigbingo/ab_test", { 
            method: "POST", 
            body: formUrlencode({ 
                experiment_id: experimentId }) }).

        then(function (resp) {return resp.json();});} };



// Expose BigBingo as a global so it can be used in khan-exercises
window.BigBingo = BigBingo;

module.exports = BigBingo;
});
KAdefine("javascript/shared-package/throbber-grid.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", foundHelper, self=this;


  buffer += "<div class=\"throbber-grid\">\n    ";
  buffer += "\n    <!--[if lte IE 9]>\n    <img class=\"throbber-fallback\" src=\"/images/throbber-full.gif\" />\n    <![endif]-->\n    <div class=\"throbber-row clearfix\">\n         <div class=\"block-0 throbber-block\"></div>\n         <div class=\"block-1 throbber-block\"></div>\n         <div class=\"block-2 throbber-block\"></div>\n    </div>\n    <div class=\"throbber-row clearfix\">\n         <div class=\"block-7 throbber-block\"></div>\n         <div class=\"block-8 throbber-block\"></div>\n         <div class=\"block-3 throbber-block\"></div>\n    </div>\n    <div class=\"throbber-row clearfix\">\n         <div class=\"block-6 throbber-block\"></div>\n         <div class=\"block-5 throbber-block\"></div>\n         <div class=\"block-4 throbber-block\"></div>\n    </div>\n</div>";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/user-dropdown.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, stack2, foundHelper, tmp1, self=this, functionType="function", blockHelperMissing=helpers.blockHelperMissing, helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "<a class=\"nav-link log-in-link\" href=\"#\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(2, program2, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</a>";
  return buffer;}
function program2(depth0,data) {
  
  
  return "Log in";}

function program4(depth0,data) {
  
  
  return "with-coach-links";}

function program6(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n        <li><a href=\"";
  foundHelper = helpers.signUpUrl;
  stack1 = foundHelper || depth0.signUpUrl;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "signUpUrl", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" class=\"name-dropdown__link primary signup-to-claim\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(7, program7, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</a></li>\n        ";
  return buffer;}
function program7(depth0,data) {
  
  
  return "Sign up to claim your points";}

function program9(depth0,data) {
  
  
  return "Profile";}

function program11(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n            <li><a href=\"/?learn=1\" class=\"name-dropdown__link dropdown-learning-home-link\">\n                ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(12, program12, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            </a></li>\n        ";
  return buffer;}
function program12(depth0,data) {
  
  
  return "Learning home";}

function program14(depth0,data) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n            <li><a href=\"/coach/dashboard\" class=\"name-dropdown__link your-students-link students-dropdown-link\">\n                ";
  foundHelper = helpers.hasStudents;
  stack1 = foundHelper || depth0.hasStudents;
  stack2 = helpers['if'];
  tmp1 = self.program(15, program15, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.program(18, program18, data);
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            </a></li>\n\n            <li><a href=\"/parent\" class=\"name-dropdown__link name-dropdown__separator\">\n            ";
  foundHelper = helpers.hasChildren;
  stack1 = foundHelper || depth0.hasChildren;
  stack2 = helpers['if'];
  tmp1 = self.program(21, program21, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.program(24, program24, data);
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            </a></li>\n        ";
  return buffer;}
function program15(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                    ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(16, program16, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n                ";
  return buffer;}
function program16(depth0,data) {
  
  
  return "Your students";}

function program18(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                    ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(19, program19, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n                ";
  return buffer;}
function program19(depth0,data) {
  
  
  return "Add students";}

function program21(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(22, program22, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            ";
  return buffer;}
function program22(depth0,data) {
  
  
  return "Your children";}

function program24(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(25, program25, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            ";
  return buffer;}
function program25(depth0,data) {
  
  
  return "Add children";}

function program27(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n        <li><a href=\"/settings/account\" class=\"name-dropdown__link\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(28, program28, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</a></li>\n        ";
  return buffer;}
function program28(depth0,data) {
  
  
  return "Settings";}

function program30(depth0,data) {
  
  
  return "Help";}

function program32(depth0,data) {
  
  
  return "Log out";}

  foundHelper = helpers.isPhantom;
  stack1 = foundHelper || depth0.isPhantom;
  stack2 = helpers['if'];
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "<span\n    id=\"user-notifications\">";
  buffer += "</span>\n\n<span class=\"name-dropdown dropdown\">\n    <a href=\"#\" class=\"username_and_notification dropdown-toggle\">\n        <img class=\"user-avatar\" src=\"";
  foundHelper = helpers.avatarSrc;
  stack1 = foundHelper || depth0.avatarSrc;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "avatarSrc", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" alt=\"\">\n        <span class=\"user-name\">";
  foundHelper = helpers.nickname;
  stack1 = foundHelper || depth0.nickname;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "nickname", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</span>\n        <i class=\"icon-caret-down\" aria-hidden=\"true\"></i>\n    </a>\n\n    <ul class=\"dropdown-menu no-submenus username-dropdown ";
  foundHelper = helpers.showCoachingLinks;
  stack1 = foundHelper || depth0.showCoachingLinks;
  stack2 = helpers['if'];
  tmp1 = self.program(4, program4, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n\n        ";
  foundHelper = helpers.showSignUpToSave;
  stack1 = foundHelper || depth0.showSignUpToSave;
  stack2 = helpers['if'];
  tmp1 = self.program(6, program6, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n        <li><a href=\"";
  foundHelper = helpers.profileRoot;
  stack1 = foundHelper || depth0.profileRoot;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "profileRoot", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" class=\"name-dropdown__link name-dropdown__separator\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(9, program9, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</a></li>\n\n        ";
  foundHelper = helpers.showLearningHome;
  stack1 = foundHelper || depth0.showLearningHome;
  stack2 = helpers['if'];
  tmp1 = self.program(11, program11, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n        ";
  foundHelper = helpers.showCoachingLinks;
  stack1 = foundHelper || depth0.showCoachingLinks;
  stack2 = helpers['if'];
  tmp1 = self.program(14, program14, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n        ";
  foundHelper = helpers.showSettings;
  stack1 = foundHelper || depth0.showSettings;
  stack2 = helpers['if'];
  tmp1 = self.program(27, program27, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n        <li><a href=\"https://khanacademy.zendesk.com\" class=\"name-dropdown__link name-dropdown__separator\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(30, program30, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</a></li>\n\n        <!-- Facebook's JS logout requires the page_logout ID -->\n        <li><a id=\"page_logout\" href=\"#\" class=\"name-dropdown__link\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(32, program32, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</a></li>\n    </ul>\n</span>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/notifications-dropdown.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, stack2, foundHelper, tmp1, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data) {
  
  
  return "Notifications";}

function program3(depth0,data) {
  
  var buffer = "", stack1;
  buffer += " (";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(4, program4, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += ")";
  return buffer;}
function program4(depth0,data) {
  
  var buffer = "", stack1;
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "count", { hash: {} }); }
  buffer += escapeExpression(stack1) + " new";
  return buffer;}

function program6(depth0,data) {
  
  
  return "Notifications";}

function program8(depth0,data) {
  
  var buffer = "", stack1;
  buffer += " (";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(9, program9, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += ")";
  return buffer;}
function program9(depth0,data) {
  
  var buffer = "", stack1;
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "count", { hash: {} }); }
  buffer += escapeExpression(stack1) + " new";
  return buffer;}

function program11(depth0,data) {
  
  
  return "brand-new";}

function program13(depth0,data) {
  
  
  return "style=\"display:none;\"";}

function program15(depth0,data) {
  
  
  return "Notifications";}

function program17(depth0,data) {
  
  
  return "No notifications. You can get back to learning!";}

  buffer += "<span class=\"dropdown\">\n    <a class=\"user-notifications-toggle dropdown-toggle nav-link user-notification\" href=\"#\" title=\"";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  stack2 = helpers['if'];
  tmp1 = self.program(3, program3, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n\n        <div class=\"sr-only\">\n            ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(6, program6, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            ";
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  stack2 = helpers['if'];
  tmp1 = self.program(8, program8, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        </div>\n\n        <span aria-hidden=\"true\">\n            <i class=\"icon-bell-alt icon-large ";
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  stack2 = helpers['if'];
  tmp1 = self.program(11, program11, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\">\n                <span class=\"notification-bubble\" ";
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  stack2 = helpers.unless;
  tmp1 = self.program(13, program13, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += ">";
  foundHelper = helpers.count;
  stack1 = foundHelper || depth0.count;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "count", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</span>\n            </i>\n            <i class=\"icon-caret-down\"></i>\n        </span>\n    </a>\n    <ul class=\"outer-dropdown-menu dropdown-menu unloaded\">\n        <li class=\"notifications-heading\">";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(15, program15, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</li>\n        <li class=\"antiscroll-wrap\">\n            <ul class=\"inner-dropdown-menu antiscroll-inner dropdown-menu no-submenus\">\n                <li class=\"loading\"><img src=\"/images/throbber.gif\"></li>\n                <li class=\"empty\" style=\"display: none;\"><div>";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(17, program17, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</div></li>\n            </ul>\n        </li>\n    </ul>\n</span>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/share-links.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, tmp1, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data) {
  
  
  return "Email";}

function program3(depth0,data) {
  
  
  return "Tweet";}

function program5(depth0,data) {
  
  
  return "Share";}

  buffer += "<div class=\"share-links\" data-badge-name=\"";
  foundHelper = helpers.name;
  stack1 = foundHelper || depth0.name;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "name", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\">\n    <a class=\"emailShare\" href=\"";
  foundHelper = helpers.emailLink;
  stack1 = foundHelper || depth0.emailLink;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "emailLink", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" target=\"_blank\">\n        <i class=\"icon-envelope\"></i>\n        ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </a>\n    <a class=\"twitterShare\" href=\"";
  foundHelper = helpers.twitterLink;
  stack1 = foundHelper || depth0.twitterLink;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "twitterLink", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" target=\"_blank\">\n        <i class=\"icon-twitter\"></i>\n        ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(3, program3, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </a>\n    <a class=\"facebookShare\" href=\"javascript:void 0\">\n        <i class=\"icon-facebook\"></i>\n        ";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(5, program5, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </a>\n	<div class=\"clearFloat\"></div>\n</div>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/badge.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, stack2, foundHelper, tmp1, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression;

function program1(depth0,data) {
  
  
  return "achievement-badge-owned";}

function program3(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "<div class=\"energy-points-badge\">";
  foundHelper = helpers.points;
  stack1 = foundHelper || depth0.points;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "points", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</div>";
  return buffer;}

  buffer += "<div class=\"achievement-badge category-";
  foundHelper = helpers.badgeCategory;
  stack1 = foundHelper || depth0.badgeCategory;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "badgeCategory", { hash: {} }); }
  buffer += escapeExpression(stack1) + " ";
  foundHelper = helpers.isOwned;
  stack1 = foundHelper || depth0.isOwned;
  stack2 = helpers['if'];
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\" title=\"";
  foundHelper = helpers.translatedSafeExtendedDescription;
  stack1 = foundHelper || depth0.translatedSafeExtendedDescription;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "translatedSafeExtendedDescription", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\">\n  <div id=\"outline-box\">\n  <img src=\"";
  foundHelper = helpers.iconSrc;
  stack1 = foundHelper || depth0.iconSrc;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "iconSrc", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" id=\"badge-icon\"/>\n  <div class=\"achievement-text\">\n  <div class=\"achievement-title\">";
  foundHelper = helpers.translatedDescription;
  stack1 = foundHelper || depth0.translatedDescription;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "translatedDescription", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</div>\n  <div class=\"achievement-desc achievement-desc-no-count\">\n    ";
  foundHelper = helpers.translatedSafeExtendedDescription;
  stack1 = foundHelper || depth0.translatedSafeExtendedDescription;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "translatedSafeExtendedDescription", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\n  </div>\n  </div>\n  ";
  foundHelper = helpers.points;
  stack1 = foundHelper || depth0.points;
  stack2 = helpers['if'];
  tmp1 = self.program(3, program3, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n  </div>\n</div>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/progress-icon.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression;


  buffer += "\n<span class=\"progress-icon icon-";
  foundHelper = helpers.type;
  stack1 = foundHelper || depth0.type;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "type", { hash: {} }); }
  buffer += escapeExpression(stack1) + "-node ";
  foundHelper = helpers.key;
  stack1 = foundHelper || depth0.key;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "key", { hash: {} }); }
  buffer += escapeExpression(stack1) + " ";
  foundHelper = helpers.extraClasses;
  stack1 = foundHelper || depth0.extraClasses;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "extraClasses", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"></span>\n\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/progress-icon-subway.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression;


  buffer += "<div class=\"subway-icon ";
  foundHelper = helpers.key;
  stack1 = foundHelper || depth0.key;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "key", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\">\n    <div class=\"pipe\"></div>\n    <div class=\"pipe completed\"></div>\n    <div class=\"status ";
  foundHelper = helpers.key;
  stack1 = foundHelper || depth0.key;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "key", { hash: {} }); }
  buffer += escapeExpression(stack1) + " ";
  foundHelper = helpers.type;
  stack1 = foundHelper || depth0.type;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "type", { hash: {} }); }
  buffer += escapeExpression(stack1) + "-node\">\n    </div>\n</div>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/navbar.js", function(require, module, exports) {
/**
 * Initializes transparent navbar which fades in upon hover, etc.
 */
var $ = require("jquery");

var init = function () {
    var $header = $(".homepage-header-ycla");
    if ($(window).width() > 480) {
        $header.find("#header-logo, .watch-link, #user-info").
        on("mouseenter focus", function () {
            $header.removeClass("header-transparent");});

        $header.on("mouseleave blur", function () {
            var inactive = !$header.is(".header-active") && 
            $header.find(".open").length === 0;
            if (inactive) {
                setTimeout(function () {
                    if (!$header.is(":hover")) {
                        $header.addClass("header-transparent");}}, 

                1000);}}).

        click(function () {
            $header.addClass("header-active");});

        $(window).click(function (e) {
            var $parents = $(e.target).parents(".homepage-header-ycla");
            if ($parents.length === 0) {
                $header.removeClass("header-active").
                addClass("header-transparent");}});}};





module.exports = init;
});
KAdefine("javascript/shared-package/video-transcript.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, stack2, foundHelper, tmp1, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression;

function program1(depth0,data) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n            ";
  foundHelper = helpers.kaIsValid;
  stack1 = foundHelper || depth0.kaIsValid;
  stack2 = helpers['if'];
  tmp1 = self.program(2, program2, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        ";
  return buffer;}
function program2(depth0,data) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n            <li data-milliseconds=\"";
  foundHelper = helpers.startTime;
  stack1 = foundHelper || depth0.startTime;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "startTime", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\">\n                <a href=\"javascript:void(0)\" data-fmttime=\"";
  foundHelper = helpers.startTime;
  stack1 = foundHelper || depth0.startTime;
  foundHelper = helpers.formatTimestamp;
  stack2 = foundHelper || depth0.formatTimestamp;
  if(typeof stack2 === functionType) { stack1 = stack2.call(depth0, stack1, { hash: {} }); }
  else if(stack2=== undef) { stack1 = helperMissing.call(depth0, "formatTimestamp", stack1, { hash: {} }); }
  else { stack1 = stack2; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.text;
  stack1 = foundHelper || depth0.text;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "text", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</a>\n            </li>\n            ";
  return buffer;}

  buffer += "<div class=\"subtitles-container desktop-only\">\n    <ul itemprop=\"transcript\" class=\"subtitles\">\n        ";
  foundHelper = helpers.subtitles;
  stack1 = foundHelper || depth0.subtitles;
  stack2 = helpers.each;
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </ul>\n</div>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/handlebars-extras.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable indent, max-len, no-console, no-unused-vars, prefer-template, space-before-function-paren */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var $ = require("jquery");
var Handlebars = require("handlebars");
var icu = require("icu");

var Autolink = require("./autolink.js");
var KA = require("./ka.js");
var i18n = require("./i18n.js");

// Only include element attributes if they have a value.
// etymology: optional attribute -> opttribute -> opttr
// example:
// var template = Handlebars.compile("<div {{opttr id=id class=class}}></div>");
// template({id: 'foo'})
// => '<div id="foo"></div>'
Handlebars.registerHelper("opttr", function (options) {
    var attrs = [];
    for (var _iterator = Object.entries(options.hash), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {var _ref;if (_isArray) {if (_i >= _iterator.length) break;_ref = _iterator[_i++];} else {_i = _iterator.next();if (_i.done) break;_ref = _i.value;}var k = _ref[0];var v = _ref[1]; // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
        if (v !== null && v !== undefined) {
            attrs.push(k + "=\"" + Handlebars.Utils.escapeExpression(v) + "\"");}}


    return new Handlebars.SafeString(attrs.join(" "));});


Handlebars.registerHelper("debug", function (data, options) {
    // Commenting out console.trace(), throws error in IE9 that
    // prevents user profile discussion page from filling out.
    //console.trace();
    console.log("Handlebars debug: ", data);});


/**
 * Use {{debugger}} in a dev environment to drop into a debugger at the given
 * point, which allows you inspect the available variables in your context and
 * to see where the template is being used from.
 *
 * Obviously, we shouldn't use this in production code!
 * TODO(alan): Add a lint check so we don't deploy usages of this.
 */
Handlebars.registerHelper("debugger", function () {
    debugger; // @Nolint
});

Handlebars.registerHelper("repeat", function (n, options) {
    var fn = options.fn;
    var ret = "";

    for (var i = 0; i < n; i++) {
        ret = ret + fn(this);}


    return ret;});


/**
 * Block helper for iterating a list with a flag when midpoint item is hit.
 *
 * This is identical to handlebars' native {{#each}} block helper, except a
 * {{midpoint}} boolean will be inserted into each iteration's context and
 * will be true when the iterable's midpoint item is hit.
 */
Handlebars.registerHelper("eachWithMidpoint", function (context, options) {
    var ret = [];
    var fn = options.fn;

    if (context) {
        var midpoint = Math.floor((context.length + 1) / 2);
        for (var i = 0; i < context.length; i++) {
            context[i]["midpoint"] = i === midpoint;
            ret.push(fn(context[i]));}}



    return ret.join("");});


/**
 * Given a list of (items), concatenate the elements to a string using a
 * serial comma.
 *
 * Examples:
 *      []                         => ""
 *      ["Jim"]                    => "Jim"
 *      ["Jim", "James"]           => "Jim and James"
 *      ["Jim", "James", "Jack"]   => "Jim, James, and Jack"
 *
 * @param {array of strings} items The list of items to concatenate
 * @param {string} fallback The string to return if items is an empty array
 * @return {string}
 */
/* TODO(csilvers): move this to a 'util' file or something: this is
   not actually a handlebars helper.
 */
var serialCommafy = function (items, fallback) {
    if (!Array.isArray(items)) {
        return fallback;}


    var n = items.length;

    // This seems to be a pretty l10n-aware, actually.  cf.
    //    http://comments.gmane.org/gmane.comp.audio.musicbrainz.i18n/15
    // The only possible problem is chinese, which it looks like
    // prefers a special character to the comma, which we hard-code in
    // items_with_commas.
    if (n === 0) {
        return fallback;} else 
    if (n === 1) {
        return items[0].toString();} else 
    if (n === 2) {
        return i18n._("%(item1)s and %(item2)s", 
        { item1: items[0].toString(), item2: items[1].toString() });} else 
    {
        return i18n._("%(items_with_commas)s, and %(last_item)s", 
        { items_with_commas: items.slice(0, n - 1).join(", "), 
            last_item: items[n - 1].toString() });}};


Handlebars.registerHelper("serialCommafy", serialCommafy);

// Register i18n handlebars methods
Handlebars.registerHelper("_", i18n.handlebarsUnderscore);
Handlebars.registerHelper("i18nDoNotTranslate", 
i18n.handlebarsDoNotTranslate);
Handlebars.registerHelper("ngettext", i18n.handlebarsNgettext);

Handlebars.registerHelper("reverseEach", function (context, block) {
    var result = "";
    for (var i = context.length - 1; i >= 0; i--) {
        result += block(context[i]);}

    return result;});


Handlebars.registerHelper("eachWithLimit", function (limit, context, block) {
    var result = "";
    for (var i = 0; i < Math.min(context.length, limit); i++) {
        result += block(context[i]);}

    return result;});


var getPartial = function (packageName, templateName) {
    // NOTE: This dynamic require is here because there's no way to do this
    // statically.. Do not copy this pattern.
    //
    // TODO(jlfwong): Change the signature from:
    //
    //      #invokePartial "shared", "throbber-gid"
    //
    // to
    //
    //      #invokePartial "javascript/shared-package/throbber-grid.handlebars"
    //
    // and stop making assumptions about this -package convention, and simplify
    // this dynamic call down to KAdefine.require("./" + templatePath);
    return KAdefine.require( // @Nolint dynamic require
    "./javascript/" + packageName + "-package/" + 
    templateName + ".handlebars");};


Handlebars.registerHelper("invokePartial", function (packageName, templateName, options) {
    return getPartial(packageName, templateName)(options.hash);});


var origInvokePartial = Handlebars.VM.invokePartial;

/**
 * This is invoked whenever a Handlebars template renders a partial via the
 * {{>some_partial} syntax.
 */
Handlebars.VM.invokePartial = function (partial, name /*, ... */) {
    // HACK: We want our Handlebars templates to require() all of their
    // dependencies so we don't need to rely on the side effect of partials
    // being registered before use. To meet this end, if the partial requested
    // hasn't been defined yet, we do our best to load it.
    //
    // We first check to see if the partial is defined, because if it is, then
    // the partial was manually registered.

    var args = Array.prototype.slice.apply(arguments);

    if (partial === undefined) {
        var parts = name.split("_");
        if (parts.length >= 2) {
            // Name will be like shared_throbber-grid
            var packageName = parts[0];
            var templateName = parts.slice(1).join("_");

            args[0] = getPartial(packageName, templateName);}}



    return origInvokePartial.apply(this, args);};


Handlebars.registerHelper("multiply", function (num1, num2) {
    return num1 * num2;});


Handlebars.registerHelper("toLoginRedirectHref", function (destination) {
    return "/login?continue=" + encodeURIComponent(destination);});


Handlebars.registerHelper("commafy", function (numPoints) {
    return icu.getIntegerFormat().format(numPoints);});


// Truncates the text and removes brackets in HTML tags
Handlebars.registerHelper("ellipsis", function (text, length) {
    // For example, "How do you use <bold>?" becomes " How do you use bold?"
    var sanitized = text.replace(/<([^>]+)>/g, function (match, p1) {
        return p1;});

    if (sanitized.length > length) {
        return sanitized.substr(0, length - 3) + "...";} else 
    {
        return sanitized;}});



var formatTimestamp_ = function (timestamp, minutes, seconds) {
    var numSeconds = 60 * parseInt(minutes, 10) + parseInt(seconds, 10);
    return "<span class='youTube' data-seconds='" + numSeconds + "'>" + 
    timestamp + "</span>";};


/* Format the content using our own flavor of markdown used in discussions. use
 * nofollow to add rel=nofollow to any links included in the content (to avoid
 * giving them link juice).
 *
 * Example:
 *
 *     > formatContent("My *spammy* blog: http://spam.com")
 *     'My <b>spammy</b> blog: <a  href="http://spam.com">http://spam.com</a>'
 *
 *     > formatContent("My *spammy* blog: http://spam.com", true)
 *     'My <b>spammy</b> blog: <a rel="nofollow"
 *     href="http://spam.com">http://spam.com</a>'
 */
var formatContent = function (content, nofollow) {
    // Escape user generated content
    content = Handlebars.Utils.escapeExpression(content);

    var timestampRegex = /(\d{1,3}):([0-5]\d)/g;
    content = content.replace(timestampRegex, formatTimestamp_);

    var newlineRegex = /[\n]/g;
    content = content.replace(newlineRegex, "<br>");

    // Replace Markdown with HTML tags. (Keep in sync with edit function in
    // discussion.js.)
    content = content.replace(/(\W|^)_(\S.*?\S)_(\W|$)/g, 
    function (m, a, b, c) {
        return a + "<em>" + b + "</em>" + c;});


    content = content.replace(/(\W|^)\*(\b.*?\b)\*(\W|$)/g, 
    function (m, a, b, c) {
        return a + "<b>" + b + "</b>" + c;});


    // Difference between <code> and <pre><code>: http://stackoverflow.com/q/4611591/
    content = content.replace(/&#x60;&#x60;&#x60;(.*?)&#x60;&#x60;&#x60;/gm, 
    function (m, n) {
        // Remove leading line breaks.
        n = n.replace(/^\s*(<br>)+/, "");
        // Remove trailing line breaks.
        n = n.replace(/(<br>)+\s*$/, "");
        return "<pre><code>" + n + "</code></pre>";});


    content = content.replace(/&#x60;(.*?)&#x60;/g, function (m, n) {
        return "<code>" + n + "</code>";});

    content = Autolink.autolink(content, nofollow);

    // Use SafeString because we already escaped the user generated
    // content and then added our own safe html
    return content;};


Handlebars.registerHelper("formatContent", function (content, options) {
    // Use SafeString because we already escaped the user generated
    // content and then added our own safe html
    return new Handlebars.SafeString(
    formatContent(content, !!(options && options.hash.nofollow)));});


/**
 * This is the jQuery version of ProjectEvalReviewViewer from
 * discussion-meta.jsx.  It is currently only used for
 * discussion/mod/flaggedfeedback because pulling in React code there would
 * be a larger change.
 */
Handlebars.registerHelper("formatEvalAnswer", function (content, options) {
    var parsed = $($.parseHTML(content));
    var items = $.makeArray(parsed.filter("li:not(.pass)"));

    // container for formatting
    var output = $("<div class='eval-guideline'>");

    // Format pass/fail info
    $("<div class='eval-title'>").text(items.length === 0 ? 
    i18n._("This project has passed evaluation.") : 
    i18n._("This project needs more work.")).
    appendTo(output);

    // Format user entered overall info
    var overallText = parsed.filter(".overall-eval-info").text();
    var overallTextFormattedSafe = formatContent(overallText, true);
    if (overallText.length > 0) {
        var div = $("<div class='more-info'>");
        div.append($("<strong>").text(i18n._("From the evaluator:"))).
        append($("<div>").html(overallTextFormattedSafe)).
        appendTo(output);}


    // Format failed objectives
    if (items.length > 0) {
        $("<div class='failed-objectives'>").append($("<strong>").
        text(i18n._("The following objectives need more work:"))).
        appendTo(output);
        var ul = $("<ul class='styled-list'>").appendTo(output);
        items.map(function (elem, i) {
            var div = $(elem).find("div");
            var moreInfoFormattedSafe = formatContent(div.text(), true);
            var extra = div.text().length > 0 ? 
            $("<div class='objective-more-info'>").
            html(moreInfoFormattedSafe) : [];
            div.empty();
            var li = $("<li></li>");
            li.append($("<strong>").text($(elem).text())).
            append(extra);
            li.appendTo(ul);});}



    // Thed dynamic user generated parts are converted to text above.
    return new Handlebars.SafeString(output[0].outerHTML);});


Handlebars.registerHelper("arrayLength", function (array) {
    return array.length;});


Handlebars.registerHelper("ifLoggedIn", function (options) {
    if (KA.getUserProfile() && !KA.getUserProfile().isPhantom()) {
        return options.fn(this);} else 
    {
        return options.inverse(this);}});



Handlebars.registerHelper("ifPhantom", function (options) {
    if (!KA.getUserProfile() || KA.getUserProfile().isPhantom()) {
        return options.fn(this);} else 
    {
        return options.inverse(this);}});



Handlebars.registerHelper("urlencode", function (text) {
    return encodeURIComponent(text);});


Handlebars.registerHelper("formatTimestamp", function (milliseconds) {
    var seconds = milliseconds / 1000;
    var secondsRemainder = parseInt(seconds) % 60;
    if (secondsRemainder < 10) {
        secondsRemainder = "0" + secondsRemainder;}

    return parseInt(seconds / 60) + ":" + secondsRemainder;});


Handlebars.registerHelper("videoOrigin", function () {
    return window.location.origin;});


/** Whether to show annotations for the given video's Youtube ID. */
// TODO(david): Find a better location for this function.
var shouldShowVideoAnnotations = function (youtubeId) {
    return ["S4iQ46ISqRQ", "yC3vsJJIcE0", "yIQUhXa-n-M", "v_OfFmMRvOc", "G7WyEp8gHs0", "765X_PAxhAw", "CDmJL-VNlaM", "u7dhn-hBHzQ", "AuX7nPBqDts", "aNqG4ChKShI", "b22tMEc6Kko", "27Kp7HJYj2c", "9Ek61w1LxSc", "DqeMQHomwAU", "VidnbCEOGdg", "9DxrF6Ttws4", "gM95HHI4gLk"].indexOf(youtubeId) === -1;};


Handlebars.registerHelper("youtubeLoadPolicyParam", function (youtubeId) {
    return shouldShowVideoAnnotations(youtubeId) ? "" : "&iv_load_policy=3";});


/**
 * A helper to strip the leading protocol from a URI, if any is found.
 */
var stripProtocol = function (url) {
    if (!url) {
        return url;}

    if (url.indexOf("http://") === 0) {
        return url.substring(5);} else 
    if (url.indexOf("https://") === 0) {
        return url.substring(6);}

    return url;};


Handlebars.registerHelper("stripProtocol", stripProtocol);

module.exports = { 
    formatContent: formatContent, 
    serialCommafy: serialCommafy, 
    stripProtocol: stripProtocol, 
    shouldShowVideoAnnotations: shouldShowVideoAnnotations };
});
KAdefine("javascript/shared-package/location-model.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Backbone Model that maps to a LocationProperty in the datastore
 */
var Backbone = require("backbone");

var LocationModel = Backbone.Model.extend({ 
    defaults: function () {
        return { 
            "lastModified": "", 
            "displayText": "", 
            "city": "", 
            "state": "", 
            "country": "", 
            "googlePlacesId": "", 
            "postalCode": "", 
            "latLng": { 
                "lat": null, 
                // ndb.GeoPt (used within the backend ndb model
                // LocationProperty) uses "lon" instead of "lng", so on save
                // this property will be overwritten by the server value.
                // TODO(stephanie): Address this problem if/when we use
                // longitude data
                "lng": null } };}, 




    /**
     * Set this model's properties to the default values.
     */
    setToDefault: function () {
        this.set(this.defaults());} });



module.exports = LocationModel;
});
KAdefine("javascript/shared-package/eduorg-models.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Backbone Model that maps to an Affiliation in the datastore
 */
var Backbone = require("backbone");

var AffiliationModel = Backbone.Model.extend({ 
    // URL to save an EduOrganization Affiliation to UserDataInfo
    url: "/api/internal/user/profile/affiliations", 

    defaults: { 
        // Affiliation to initialize the EduorgPicker with
        "eduorgKeyId": "", 
        "eduorgName": "", 
        "eduorgPostalCode": "", 
        "eduorgLocationText": "", 
        "role": null } });



var Affiliations = Backbone.Collection.extend({ 
    model: AffiliationModel });


exports.AffiliationModel = AffiliationModel;
exports.Affiliations = Affiliations;
});
KAdefine("javascript/shared-package/profile-model.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-unused-vars, no-useless-call, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Code to handle the public components of a profile.
 */

/**
 * Profile information about a user.
 * May be complete, partially filled, or mostly empty depending on the
 * permissions the current user has to this profile.
 */
var $ = require("jquery");
var Backbone = require("backbone");

var i18n = require("./i18n.js");
var KA = require("./ka.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;var encodeParams = _require.encodeParams;

var ProfileModel = Backbone.Model.extend({ 
    defaults: { 
        "affiliations": [], 
        "avatarName": "darth", 
        "avatarSrc": "/images/darth.png", 
        "backgroundName": "", 
        "backgroundSrc": "", 
        "bio": "", 
        "userLocation": null, 
        "countVideosCompleted": 0, 
        "dateJoined": "", 
        "email": "", 
        "isCoachingLoggedInUser": false, 
        "isParentOfLoggedInUser": false, 
        "isActivityAccessible": false, 
        "nickname": "", 
        "points": 0, 
        "username": "", 
        "isDataCollectible": false, 
        "isSelf": false, 
        "isPublic": false, 
        "isCreator": false, 
        "isCurator": false, 
        "isPublisher": false, 
        "followRequiresApproval": true, 
        "canModifyCoaches": true, 
        "hideVisual": false }, 


    url: "/api/internal/user/profile", 

    isPhantom: function () {
        return this.get("isPhantom");}, 


    isCurrentUser: function () {
        return KA.getUserProfile() && 
        KA.getUserProfile().get("kaid") === this.get("kaid");}, 


    initialize: function (attributes, options) {
        Backbone.Model.prototype.initialize.call(this, attributes, options);

        this._ensureAttrsAreSubmodels();

        // Any time the submodel attributes are set(), we need to make sure
        // they're still models of the right type.
        var eventStr = ProfileModel.SUBMODEL_ATTRS.
        map(function (attr) {return "change:" + attr;}).join(" ");
        this.on(eventStr, this._ensureAttrsAreSubmodels, this);}, 


    locationFormatted: function () {
        var location = this.get("userLocation");
        return location && location.get("displayText") || "";}, 


    usernameFormatted: function () {
        var username = this.get("username");
        return username ? "@" + username : "";}, 


    /**
     * Instantiate Backbone models for complex attributes that have dedicated
     * models and set() them on this ProfileModel.
     *
     * Will only reassign attributes that aren't already assigned to Backbone
     * models of the right type.
     */
    _ensureAttrsAreSubmodels: function (options) {
        var AffiliationModel = require(
        "../shared-package/eduorg-models.js").AffiliationModel;
        var Affiliations = require(
        "../shared-package/eduorg-models.js").Affiliations;
        var LocationModel = require(
        "../shared-package/location-model.js");

        var attrs = {};

        var userLocation = this.get("userLocation");
        if (!(userLocation instanceof LocationModel)) {
            attrs["userLocation"] = new LocationModel(userLocation);}


        var affiliations = this.get("affiliations");
        if (!affiliations || !affiliations.length) {
            affiliations = [new AffiliationModel()];}

        if (!(affiliations instanceof Affiliations)) {
            attrs["affiliations"] = new Affiliations(affiliations);}


        this.set(attrs, { silent: true });}, 


    /**
     * Whether or not the user's data is private to the current actor.
     */
    isPrivate: function () {
        return this.get("isActivityAccessible") === false && 
        this.get("isPublic") === false;}, 


    /**
     * Whether or not the current actor on the app can access this user's full
     * activity and goals data. This is available, for example, to coaches of
     * the user.
     */
    isActivityAccessible: function () {
        return this.get("isActivityAccessible");}, 


    /**
     * Returns either an e-mail or username that will uniquely identify the
     * user.
     *
     * Note that not all users have a username, and not all users have
     * an e-mail. However, if the actor has full access to this profile,
     * at least one of these values will be non empty.
     */
    getIdentifier: function () {
        return this.get("username") || this.get("email");}, 


    /**
     * Whether or not the current actor can customize this profile.
     * Note that users under 13 without parental consent can only
     * edit some data; clients should also check isDataCollectible for full
     * information about fields which can be edited.
     */
    isEditable: function () {
        return this.get("isSelf") && !this.isPhantom();}, 


    isFullyEditable: function () {
        return this.isEditable() && this.get("isDataCollectible");}, 


    /**
     * For giving Sal a fun profile
     */
    isSal: function () {
        return this.get("username") === "sal";}, 


    toJSON: function () {var _this = this;
        var json = ProfileModel.__super__.toJSON.call(this);

        // Serialize computed attributes by simply calling them
        ProfileModel.COMPUTED_ATTRS.forEach(function (attr) {
            json[attr] = _this[attr].call(_this);});


        // Serialize submodel attributes by calling toJSON() on them
        ProfileModel.SUBMODEL_ATTRS.forEach(function (attr) {
            json[attr] = _this.get(attr).toJSON();});


        return json;}, 


    /**
     * Returns the property from the JSON object if it exists.
     * Defaults to the current value of the property on "this".
     */
    getIfUndefined: function (obj, prop) {
        if (obj && obj[prop] !== undefined) {
            return obj[prop];}

        return this.get(prop);}, 


    /**
     * Override Backbone.Model.save since only some of the fields are
     * mutable and saveable.
     */
    save: function (attrs, options) {
        options = options || {};
        options.contentType = "application/json";
        options.data = JSON.stringify({ 
            // Note that Backbone.Model.save accepts arguments to save to
            // the model before saving, so check for those first.
            "kaid": this.getIfUndefined(attrs, "kaid"), 
            "userKey": this.getIfUndefined(attrs, "userKey"), 
            "avatarName": this.getIfUndefined(attrs, "avatarName"), 
            "bio": this.getIfUndefined(attrs, "bio"), 
            "backgroundName": this.getIfUndefined(attrs, "backgroundName"), 
            "nickname": $.trim(this.getIfUndefined(attrs, "nickname")), 
            "username": this.getIfUndefined(attrs, "username"), 
            "isPublic": this.getIfUndefined(attrs, "isPublic"), 
            "hideVisual": this.getIfUndefined(attrs, "hideVisual"), 
            "userLocation": this.getIfUndefined(attrs, "userLocation"), 
            "affiliations": this.getIfUndefined(attrs, "affiliations") });


        // Trigger a custom "savesuccess" event, since it's useful for clients
        // to know when certain operations succeeded on the server.
        var success = options.success;
        options.success = function (model, resp) {
            model.trigger("savesuccess");
            if (success) {
                success(model, resp);}};


        Backbone.Model.prototype.save.call(this, attrs, options);}, 


    /**
     * Temporarily store the current state of the model so that we may revert
     * back to it if necessary.
     *
     * Used in username-picker.jsx.
     */
    storeState: function () {
        var attrs = this.toJSON();
        // Filter out computed attributes
        this._storedAttrs = Object.keys(attrs).reduce(function (result, prop) {
            if (!ProfileModel.COMPUTED_ATTRS.includes(prop)) {
                result[prop] = attrs[prop];}

            return result;}, 
        {});}, 


    /**
     * Restore the the model to the previous state stored via storeState().
     *
     * Used in username-picker.jsx to restore the model back to a previous
     * state after a failed save. The reason we can't just use
     * previousAttributes() is because the bio and user location-editing React
     * components set() the model on every change.
     */
    restoreState: function () {var _this2 = this;
        // Set all plain, non-complex attributes first
        var attrs = Object.keys(this._storedAttrs).reduce(function (result, prop) {
            if (!ProfileModel.SUBMODEL_ATTRS.includes(prop)) {
                result[prop] = _this2._storedAttrs[prop];}

            return result;}, 
        {});
        this.set(attrs);

        // Set submodel attributes
        var sattrs = Object.keys(this._storedAttrs).reduce(function (result, prop) {
            if (ProfileModel.SUBMODEL_ATTRS.includes(prop)) {
                result[prop] = _this2._storedAttrs[prop];}

            return result;}, 
        {});

        for (var _iterator = Object.entries(sattrs), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {var _ref;if (_isArray) {if (_i >= _iterator.length) break;_ref = _iterator[_i++];} else {_i = _iterator.next();if (_i.done) break;_ref = _i.value;}var attr = _ref[0];var val = _ref[1]; // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
            this.get(attr).set(val);}}, 



    /**
     * Idempotent function to fetch a full version of UserProfile that
     * includes properties in UserDataInfo (bio, location, school
     * affiliations, etc.).
     */
    fetchFull: function () {var _this3 = this;
        // Return immediately if we've got the full version already
        if (this.get("includesUserDataInfo")) {
            return Promise.resolve();}


        var params = { 
            casing: "camel", 
            kaid: this.get("kaid") };


        // Get a full version of the profile with all the UserDataInfo
        // properties
        return khanFetch("/api/internal/user/profile?" + encodeParams(params)).
        then(function (resp) {return resp.json();}).
        then(function (data) {
            if (data) {
                _this3.set(data);}});}, 




    // TODO: figure out how to do this in a more systematic way!
    // Override base Backbone.parse since badge modifications can result in
    // api_action_results to be sent back.
    parse: function (resp, xhr) {
        if ("apiActionResults" in resp && "payload" in resp) {
            resp = resp["payload"];}

        return Backbone.Model.prototype.parse.call(this, resp, xhr);}, 


    validateNickname: function (nickname) {
        this.trigger("validate:nickname", $.trim(nickname).length > 0);}, 


    validateUsername: function (username) {var _this4 = this;
        // Can't define validate() (or I don't understand how to)
        // because of https://github.com/documentcloud/backbone/issues/233

        // Remove any feedback if user returns to her current username
        if (username === this.get("username")) {
            this.trigger("validate:username");
            return;}


        // Must be consistent with canonicalizing logic on server.
        username = username.toLowerCase().replace(/\./g, "");

        // Must be synced with server's understanding
        // in UniqueUsername.is_valid_username()
        if (/^[a-z][a-z0-9]{2,}$/.test(username)) {
            khanFetch("/api/internal/user/username_available?" + 
            encodeParams({ username: username })).
            then(function (resp) {return resp.json();}).
            then(function (data) {return _this4.onValidateUsernameResponse_(data);});} else 
        {
            var message = "";
            if (username.length < 3) {
                message = i18n._("Too short.");} else 
            if (/^[^a-z]/.test(username)) {
                message = i18n._("Start with a letter.");} else 
            {
                message = i18n._("Letters and numbers only.");}

            this.trigger("validate:username", message, false);}}, 



    onValidateUsernameResponse_: function (isUsernameAvailable) {
        var message = isUsernameAvailable ? i18n._("Looks good!") : i18n._("Not available.");
        this.trigger("validate:username", message, isUsernameAvailable);} }, 

{ 

    /**
     * List of attributes that are computed from other attributes. Functions
     * with these names will automatically be evaluated in/added to the
     * serialized output of toJSON().
     */
    COMPUTED_ATTRS: [
    "isEditable", 
    "isFullyEditable", 
    "isSal", 
    "locationFormatted", 
    "usernameFormatted"], 


    /**
     * List of attributes that themselves are instances of other Backbone
     * models.
     */
    SUBMODEL_ATTRS: [
    "userLocation", 
    "affiliations"] });



module.exports = ProfileModel;
});
KAdefine("javascript/shared-package/youtube-iframe-player.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, stack2, foundHelper, tmp1, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression, blockHelperMissing=helpers.blockHelperMissing;

function program1(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n    <div style=\"background-image: url('";
  foundHelper = helpers.thumbnailUrl;
  stack1 = foundHelper || depth0.thumbnailUrl;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "thumbnailUrl", { hash: {} }); }
  buffer += escapeExpression(stack1) + "');\"\n         class=\"poster-frame\">\n    </div>\n    <button aria-label=\"";
  foundHelper = helpers['_'];
  stack1 = foundHelper || depth0['_'];
  tmp1 = self.program(2, program2, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  if(foundHelper && typeof stack1 === functionType) { stack1 = stack1.call(depth0, tmp1); }
  else { stack1 = blockHelperMissing.call(depth0, stack1, tmp1); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\" class=\"larger-play-button\"></button>\n";
  return buffer;}
function program2(depth0,data) {
  
  
  return "Play video";}

function program4(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n    data-topicid=\"";
  foundHelper = helpers.topicId;
  stack1 = foundHelper || depth0.topicId;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "topicId", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"\n    ";
  return buffer;}

function program6(depth0,data) {
  
  
  return "1";}

function program8(depth0,data) {
  
  
  return "0";}

function program10(depth0,data) {
  
  
  return "1";}

function program12(depth0,data) {
  
  
  return "0";}

  foundHelper = helpers.showLargerPlayButton;
  stack1 = foundHelper || depth0.showLargerPlayButton;
  stack2 = helpers['if'];
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n\n<iframe\n    class=\"player\"\n    type=\"text/html\"\n    width=\"";
  foundHelper = helpers.width;
  stack1 = foundHelper || depth0.width;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "width", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"\n    height=\"";
  foundHelper = helpers.height;
  stack1 = foundHelper || depth0.height;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "height", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"\n    data-youtubeid=\"";
  foundHelper = helpers.youtubeId;
  stack1 = foundHelper || depth0.youtubeId;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "youtubeId", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"\n    data-translatedyoutubeid=\"";
  foundHelper = helpers.translatedYoutubeId;
  stack1 = foundHelper || depth0.translatedYoutubeId;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "translatedYoutubeId", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"\n    data-translatedyoutubelang=\"";
  foundHelper = helpers.translatedYoutubeLang;
  stack1 = foundHelper || depth0.translatedYoutubeLang;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "translatedYoutubeLang", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\"\n    ";
  foundHelper = helpers.topicId;
  stack1 = foundHelper || depth0.topicId;
  stack2 = helpers['if'];
  tmp1 = self.program(4, program4, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    src=\"https://www.youtube.com/embed/";
  foundHelper = helpers.translatedYoutubeId;
  stack1 = foundHelper || depth0.translatedYoutubeId;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "translatedYoutubeId", { hash: {} }); }
  buffer += escapeExpression(stack1) + "?enablejsapi=1&html5=1&wmode=transparent&modestbranding=1&rel=0&fs=1&showinfo=";
  foundHelper = helpers.isEmbedded;
  stack1 = foundHelper || depth0.isEmbedded;
  stack2 = helpers['if'];
  tmp1 = self.program(6, program6, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.program(8, program8, data);
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "&autoplay=";
  foundHelper = helpers.videoAutoplay;
  stack1 = foundHelper || depth0.videoAutoplay;
  stack2 = helpers['if'];
  tmp1 = self.program(10, program10, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.program(12, program12, data);
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "&origin=";
  foundHelper = helpers.videoOrigin;
  stack1 = foundHelper || depth0.videoOrigin;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "videoOrigin", { hash: {} }); }
  buffer += escapeExpression(stack1);
  foundHelper = helpers.translatedYoutubeId;
  stack1 = foundHelper || depth0.translatedYoutubeId;
  foundHelper = helpers.youtubeLoadPolicyParam;
  stack2 = foundHelper || depth0.youtubeLoadPolicyParam;
  if(typeof stack2 === functionType) { stack1 = stack2.call(depth0, stack1, { hash: {} }); }
  else if(stack2=== undef) { stack1 = helperMissing.call(depth0, "youtubeLoadPolicyParam", stack1, { hash: {} }); }
  else { stack1 = stack2; }
  buffer += escapeExpression(stack1) + "\"\n    frameborder=\"0\"\n    allowfullscreen\n    webkitallowfullscreen\n    mozallowfullscreen\n ></iframe>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/poppler.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable eqeqeq, max-len, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Poppler is an event triggering library for streams, such as a video.
 *
 * It maintains state of a stream, handling events such as the user scrubbing
 * back and forth, or the stream playing normally, and allows clients to
 * register events at certain points in the stream.
 */
var _ = require("../../third_party/javascript-khansrc/lodash/lodash.js");

var KAConsole = require("./console.js");

var Poppler = (function () {
    function Poppler() {
        this.events = [];
        this.duration = -1;
        this.eventIndex = 0;
        this.indicesById = {};
        this.began = false;
        this.blocked = false;}


    Poppler.timeFn = function (e) {
        return e.time;};


    Poppler.nextPeriod = function (n, period) {
        return Math.round(Math.floor(n / period + 1)) * period;};


    // TODO(benkomalo): stop modifying the passed in fn so no unintended
    //     side-effects occur (e.g. if the client re-uses a function for
    //     multiple points in the stream)
    /**
     * Registers a callback to be invoked at a certain point in the stream.
     * @param {number} time The time, in seconds, at which the callback should
     *     be triggered.
     * @param {Function} fn The callback to invoke. Must be distinct callbacks
     *     for each registration, since it will be modified with properties.
     * @param {string} id The id for this event.
     */
    Poppler.prototype.add = function (time, fn, id) {
        fn.time = time;
        fn.id = id;
        var i = _.sortedIndex(this.events, fn, Poppler.timeFn);

        // if there are existing elements with the same time, insert afterwards
        while (this.events[i] && this.events[i].time === time) {
            i++;}


        this.events.splice(i, 0, fn);};


    Poppler.prototype.begin = function () {
        this.began = true;

        // make an index of id -> index to seek by id
        this.indicesById = this.events.reduce(function (o, ev, i) {
            o[ev.id] = i;
            return o;}, 
        {});};


    /**
     * Triggers an event check. Typically called in a throttled loop.
     */
    Poppler.prototype.trigger = function trigger(time) {
        if (!this.began) {
            this.begin();}

        if (this.blocked) {
            return;}


        if (this.duration !== -1) {
            // if this is not the initial trigger, do some sanity checks
            var delta = time - this.duration;

            // ignore duplicate triggers
            var epsilon = 0.001;
            if (Math.abs(delta) < epsilon) {
                return;}


            // ignore any huge jumps
            var maxJumpSize = 1;
            if (Math.abs(delta) > maxJumpSize) {
                return;}}



        this.duration = time;
        this._triggerEvents();};


    Poppler.prototype._triggerEvents = function () {
        var start = this.eventIndex;
        while (this.events[this.eventIndex] && this.events[this.eventIndex].time <= this.duration) {
            var blocking = this.events[this.eventIndex]();
            this.eventIndex++;
            if (blocking) {
                this.blocked = true;
                break;}}


        return start !== this.eventIndex;};


    Poppler.prototype.resumeEvents = function () {
        this.blocked = false;
        return this._triggerEvents();};


    Poppler.prototype.seek = function (time) {
        if (!this.began) {
            this.begin();}


        this.duration = time;
        this.eventIndex = _.sortedIndex(this.events, { time: this.duration }, Poppler.timeFn);
        KAConsole.log("Poppler.seek, duration:", this.duration, "eventIndex:", this.eventIndex);};


    Poppler.prototype.seekToId = function (id) {
        if (!this.began) {
            this.begin();}


        var i = this.indicesById[id];
        if (i == null) {
            throw new Error("No event found with id" + id);}

        var e = this.events[i];

        this.duration = e.time;
        this.eventIndex = i;
        KAConsole.log("Poppler.seekToId, duration:", this.duration, "eventIndex:", this.eventIndex);};


    return Poppler;})();


module.exports = Poppler;
});
KAdefine("javascript/shared-package/jquery.delayload.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable max-len, no-trailing-spaces, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var $ = require("jquery");

// Functions to help figure out whether elements are in the viewport
//  and lazy-load their content if so.
// Implemented as jQuery plugins.
$.fn.inView = function (nearThreshold) {
    var $elem = $(this);
    // Checks if its visible, CSS-wise
    if (!$elem.is(":visible")) {
        return false;}

    // Checks if its visible, screen-wise, within threshold
    var viewportHeight = $(window).height();
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var elemTop = $elem.offset().top;
    nearThreshold = nearThreshold || 0;
    if (scrollTop + viewportHeight + nearThreshold > elemTop) {
        return true;}

    return false;};


$.fn.delayLoad = function (nearThreshold, callback) {
    var $elem = $(this);
    // divs with background-image set
    if ($elem.data("delayed-bgimage") && 
    $elem.css("background-image") === "none" && 
    $elem.inView(nearThreshold)) {
        setTimeout(function () {
            $elem.css("background-image", "url(" + $elem.data("delayed-bgimage") + ")");}, 
        0);
        return true;}

    // iframes or images
    if ($elem.data("delayed-src") && (
    !$elem.attr("src") || $elem.attr("src") === "about:blank") && 
    $elem.inView(nearThreshold)) {
        setTimeout(function () {
            $elem.attr("src", $elem.data("delayed-src"));}, 
        0);
        return true;}

    // elements to which other elements, such as videos, are appended with event listeners
    if (typeof callback === "function" && $elem.inView(nearThreshold) && !$elem.data("hasAppended")) {
        //append element only once
        $elem.data("hasAppended", true);
        setTimeout(function () {
            callback($elem);}, 
        0);
        return true;}

    return false;};
});
KAdefine("javascript/shared-package/background-video.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, space-after-keywords, space-infix-ops */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var $ = require("jquery");

/**
 * Make background responsive. Background covers parent container
 * while remaining centered and keeping aspect ratio.
 * @param {Object} videoEl DOM element
 */
var resizeVideo = function (videoEl, videoProps) {
    var originalHeight = videoProps.height;
    var originalWidth = videoProps.width;
    var aspectRatio = originalWidth / originalHeight;
    var $videoEl = $(videoEl);
    // using innerHeight to include padding that gets applied when screen is small
    // also add extra pixels because IE9/10 do not render the bottom ~5px of video
    // tried scaling height of original video to 410 (multiple of 820) but no effect
    // so unclear why this is a problem in IE
    // (TODO) Shane: find a better fix for IE
    var containerHeight = $videoEl.parent().innerHeight() + 5;
    var containerWidth = $videoEl.parent().innerWidth();
    var containerAspectRatio = containerWidth / containerHeight;

    var newWidth;
    var newHeight;

    if (aspectRatio <= containerAspectRatio) {
        newWidth = containerWidth;
        newHeight = containerWidth / aspectRatio;} else 
    {
        newHeight = containerHeight;
        newWidth = containerHeight * aspectRatio;}


    // center
    $videoEl.css({ 
        height: newHeight, 
        left: containerWidth / 2 - newWidth / 2, 
        top: containerHeight / 2 - newHeight / 2, 
        width: newWidth });


    // reveal video after loaded and resized for the first time
    if (!$videoEl.data("isShown")) {
        $videoEl.data("isShown", true);
        $videoEl.css("z-index", 0);
        videoEl.play();}};



var addBackgroundAndListeners = function ($elem, videoProps) {
    var video = $.parseHTML(videoProps.element)[0];
    var $video = $(videoProps.element);

    var onResize = function () {
        // resize the video as soon as enough data loaded to play
        // one frame: http://www.w3schools.com/tags/av_prop_readystate.asp
        if (video.readyState >= 2) {
            resizeVideo(video, videoProps);}};



    $video.on("loadeddata", onResize);

    // dynamically append video elements, because of browser quirks
    // involved in dynamically managing existing source elements:
    // http://stackoverflow.com/questions/5235145/changing-source-on-html5-video-tag
    $elem.append(video);

    $(window).resize(onResize);};


module.exports = { 
    addBackgroundAndListeners: addBackgroundAndListeners };
});
KAdefine("javascript/shared-package/khan-fetch.js", function(require, module, exports) {
/**
 * This module supplies a wrapper around the global `fetch` function, which
 * adds some useful functionality that we want when making requests.
 *
 * In particular, it:
 *  - sends cookies by default on same-origin requests
 *  - fails the promise chain when we receive a non-2xx response, for backwards
 *    compatibility with $.ajax:
 *    https://github.com/github/fetch/blob/master/README.md#handling-http-error-statuses
 *
 * It also adds the same functionality that is added to `$.ajax` calls in
 * api-action-results.js, namely:
 *  - Adds a lang= parameter to API calls
 *  - Adds a cache-busting _= parameter to API calls
 *  - Adds the XSRF header
 *  - Checks for API version mismatches
 *  - Checks for API action results
 */

var APIActionResults = require("./api-action-results.js");
var KA = require("./ka.js");

// It is difficult to make copies of Request objects with modified URLs. This
// function does as good as is currently possible to copy a request with a new
// URL, while maintaining all of the properties of the old Request, including
// the body. It returns a Promise which resolves to the new Request.
//
// This solution comes from http://stackoverflow.com/a/34641566/57318
// According to https://github.com/whatwg/fetch/issues/191, this should
// eventually be equivalent to `new Request(url, request)`, but that doesn't
// yet work.
function copyRequestWithUrl(url, request) {
    var bodyPromise = 
    request.headers.get("Content-Type") ? 
    request.blob() : 
    Promise.resolve(undefined);
    return bodyPromise.then(function (body) {
        return new Request(url, { 
            body: body, 
            method: request.method, 
            headers: request.headers, 
            referrer: request.referrer, 
            referrerPolicy: request.referrerPolicy, 
            mode: request.mode, 
            credentials: request.credentials, 
            cache: request.cache, 
            redirect: request.redirect, 
            integrity: request.integrity });});}




// By default, cookies aren't sent with fetch requests. We set the request to
// send cookies by default.
// TODO(emily): Figure out a way to let someone explicitly omit headers (would
// we ever want that?).
function sendCookies(request) {
    if (request.credentials === "omit") {
        return new Request(request, { credentials: "same-origin" });}

    return request;}


// Adds a lang= parameter to requests if a language is set by calling out to
// the appropriate APIActionResults function.
function addLangParam(request) {
    if (KA.language) {
        return copyRequestWithUrl(
        APIActionResults.addLangParam(
        request.url, KA.language), 
        request);} else 
    {
        return request;}}



// Adds a _= cache parameter to API requests by calling out to the appropriate
// APIActionResults function.
function addCacheParam(request) {
    var newUrl = APIActionResults.addCacheParam(request.url);
    return copyRequestWithUrl(newUrl, request);}


// Adds the XSRF header to the request by calling out to the appropriate
// APIActionResults function.
function addXsrfKey(request) {
    var headers = new Headers(request.headers);
    var succeeded = APIActionResults.addXsrfKey(
    request.url, 
    function (name, value) {return headers.set(name, value);});
    if (!succeeded) {
        throw new Error("Request cancelled because xsrf key was missing");}

    return new Request(request, { headers: headers });}


// Since `fetch` by default doesn't fail when the status is a non-2xx status,
// we add a check to every request's promise chain that fails it when these
// errors occur.
function checkStatus(response) {
    // Code taken from
    // https://github.com/github/fetch/blob/master/README.md#handling-http-error-statuses
    if (response.status >= 200 && response.status < 300) {
        return response;} else 
    {
        var error = new Error(response.statusText);
        error.response = response;
        throw error;}}



// Checks for API version mismatches by calling out to the appropriate
// APIActionResults function.
function checkApiVersionMismatch(response) {
    APIActionResults.checkApiVersionMismatch(
    function (header) {return response.headers.get(header);});
    return response;}


// Checks for API results by passing the response body to the appropriate
// APIActionResults function.
function checkApiResponse(response) {
    // In order to inspect the body of the Response, we must clone it (so that
    // future users can also look at the response body). APIActionResults wants
    // the text body of the response, so we pull that out with .text().
    response.clone().text().then(
    function (responseBody) {
        APIActionResults.checkApiResponse(
        responseBody, 
        function (header) {return response.headers.get(header);});});


    return response;}


// The actual fetch wrapper. In general, this function
//  - creates a Request object from the input
//  - calls the functions above which modify Request objects
//  - makes a `fetch` call with the generated Request
//  - calls the functions above which inspect the Response
//
// We wrap all of these into a long Promise chain in order to make error
// handling easy (for instance, the functions which modify Requests can easily
// cancel the fetch by throwing an error).
function khanFetch(input, init) {
    return Promise.resolve(new Request(input, init)).
    then(sendCookies).
    then(addLangParam).
    then(addCacheParam).
    then(addXsrfKey).
    then(function (request) {return fetch(request);}) // @Nolint(emily): this is the only
    // place we're allowed to use the
    // native/polyfilled fetch function
    .then(checkStatus).
    then(checkApiVersionMismatch).
    then(checkApiResponse);}


// This is a helper function for encoding JS objects as query parameters or
// x-www-form-urlencoded data. This was adapted from
// https://github.com/inexorabletash/polyfill/blob/master/url.js:urlencoded_serialize
//
// Input: An object. Note that the values of this object will simply be
//        converted to strings, so you need to serialize them yourself
//        manually. (Especially note that arrays probably won't do what you
//        want)
// Output: A string, containing all of the key/value pairs urlencoded and
//         concatenated.
//
// Ex: `encodeParams({ a: "hello", b: "world" })` -> "a=hello&b=world"
//
// This is useful for replacing usages of `$.ajax`, which used this encoding to
// add URL parameters to GET requests. For example,
//   $.ajax("/test", { data: { casing: "camel" } }); @Nolint
// can be replaced with
//   khanFetch(`/test?${encodeParams({ casing: "camel" })}`);
function encodeParams(data) {
    var output = "";
    var first = true;
    for (var _iterator = Object.entries(data), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {var _ref;if (_isArray) {if (_i >= _iterator.length) break;_ref = _iterator[_i++];} else {_i = _iterator.next();if (_i.done) break;_ref = _i.value;}var _name = _ref[0];var value = _ref[1];
        var nameEnc = encodeURIComponent(_name);
        var valueEnc = encodeURIComponent(value);
        if (!first) {
            output += "&";}

        output += nameEnc + "=" + valueEnc;
        first = false;}

    return output.replace(/%20/g, "+");}


// This is a helper function for use with fetch which x-www-form-urlencodes the
// given data, and then returns a Blob with the data and the correct type.
//
// Ideally, we would be using a URLSearchParams object instead of a Blob object
// here, but URLSearchParams isn't supported on IE 10, so we would have to
// polyfill it which would be annoying.
//
// This is useful for replacing usages of `$.ajax`, which defaulted to this
// encoding for POST data. For example,
//   $.ajax("/test", { method: "POST", data: { ... } }); @Nolint
// can be replaced with
//   khanFetch("/test", { method: "POST", body: formUrlencode({ ... }) });
function formUrlencode(data) {
    return new Blob(
    [encodeParams(data)], 
    { type: "application/x-www-form-urlencoded;charset=UTF-8" });}



// This is a helper function for reading the contents of a `Blob` as text.
// Since the `khanFetch` implementation converts body data into a `Blob` before
// sending it, it is hard for tests to inspect this body manually. This
// function returns a Promise which resolves to the text contents of a Blob.
function readBlob(blob) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.addEventListener("load", function () {return resolve(reader.result);});
        reader.addEventListener("error", function () {return reject(reader.error);});
        reader.readAsText(blob);});}



module.exports = { 
    khanFetch: khanFetch, 
    encodeParams: encodeParams, 
    formUrlencode: formUrlencode, 
    readBlob: readBlob };
});
KAdefine("javascript/shared-package/nav-header.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-extra-bind, one-var */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Handle site wide navigation, including rendering and interacting with the
 * header.
 *
 * TODO(marcia): I had named this file ka-nav.js to distinguish it from
 * tutorial-nav.js, but then I learned that there is also a khan-nav.js. That
 * is super confusing and we should rename these files more clearly!
 *
 * TODO(stephanie): Refactored ka-nav.js into two separate files, nav-
 * header.js and nav-footer.js, on 2013-12-18 as part of FIXIT VII (Santa
 * Isn't Real), but still has same issues as above...
 */

require("../../third_party/javascript-khansrc/jqueryui/jquery.ui.effect.js");
var $ = require("jquery");
var React = require("react");
var ReactDOM = require("react-dom");

var i18n = require("./i18n.js");
var HeaderTopicBrowser = require("../shared-package/header-topic-browser.js"); // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
var KA = require("./ka.js");
var bindSignupLink = require("./bind-signup-link.js");

var ResponsiveNavMenu = React.createFactory(require("../shared-package/responsive-nav-menu.jsx"));
var SiteInfra = require("../shared-package/site-infra.js"); // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
var updateDocumentTitle = require("./update-document-title.js");


var NavHeader = { // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
    _renderedUserDropdown: false, 
    _renderedNotificationsDropdown: false, 

    searchBox: null, 
    activeMission: null, 
    searchBoxGuider: null, 

    /**
     * Expects an object with loginUrl, logoutUrl, and signUpUrl properties.
     */
    init: function (options) {var _this = this;
        this._userDropdownContext = babelHelpers._extends({ 
            showSignUpToSave: true, 
            showSettings: false }, 
        options // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
        ); // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)

        bindSignupLink($(".sign-up-link"));

        // While the nav is loading, update the document title to reflect the
        // user's number of brand new notifications.
        updateDocumentTitle();

        var $input = $("#top-header-container .nav-search-box input");
        $input.one("mouseover focus keydown touchstart", function () {
            _this.renderSearchBox();});


        // Render the responsive mobile menu. Eventually it would be good to
        // have this replace the regular subjects menu.
        var $responsiveNavMenu = $(".responsive-nav-menu");
        if ($responsiveNavMenu.length) {
            ReactDOM.render(ResponsiveNavMenu({ 
                domains: options.domains || [], 
                profileModel: KA.getUserProfile() }), 
            $responsiveNavMenu[0]);

            // TODO(david): Make this into a React component instead.
            // TODO(david): Animate the icon change transition:
            //     http://lukyvj.github.io/menu-to-cross-icon/
            var $navbarToggleMenu = $(".navbar-toggle-menu");

            var toggleMenu = function () {
                $responsiveNavMenu.slideToggle({ 
                    duration: 300, 
                    easing: "easeOutCubic" });


                $navbarToggleMenu.toggleClass("navbar-menu-open");
                $navbarToggleMenu.attr("aria-expanded", function () {
                    return $(this).hasClass("navbar-menu-open");});};



            $navbarToggleMenu.click(toggleMenu);
            $navbarToggleMenu.on("keydown", function (e) {
                // Space and Enter keys should toggle the menu as well
                if (e.keyCode === 13 || e.keyCode === 32) {
                    e.preventDefault();
                    toggleMenu();}});}}, 



    // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)

    renderSearchBox: function () {var _this2 = this;
        require.async([
        "../typeahead-package/render-nav-search-bar.js", 
        "package!typeahead.css"], 
        function (renderNavSearchBar) {
            _this2.searchBox = renderNavSearchBar({ 
                firstRender: !_this2.searchBox, 
                searchBox: $("#top-header-container .nav-search-box")[0], 
                activeMission: _this2.activeMission, 
                guider: _this2.searchBoxGuider, 
                onFocus: function () {return _this2.hideSearchGuider();}, 
                useGoogle: KA.GOOGLE_RESULTS_ONLY, 
                extraFormArgs: { referer: window.location.pathname } });});}, 




    setActiveMission: function (userMission) {
        // TODO(benkomalo): maybe this should be consolidated with where
        // the learn menu is updated. :/
        this.activeMission = userMission;
        if (this.searchBox) {
            // Need to re-render.
            this.renderSearchBox();}}, 



    showSearchGuider: function () {var _this3 = this;
        $("html, body").animate(
        { scrollTop: 0 }, 
        function () {
            require.async(["../react-guiders-package/guider.jsx"], function (Guider) {
                Guider = React.createFactory(Guider);

                var description;
                if (_this3.activeMission) {
                    var missionTitle = 
                    _this3.activeMission.get("translatedTitle");
                    description = i18n._(
                    "You can search all of Khan Academy here to " + 
                    "find what you want to learn. If you choose a " + 
                    "skill from %(missionTitle)s, it will be added " + 
                    "to your learning dashboard and opened here.", 
                    { 
                        missionTitle: missionTitle });}



                if (!description) {
                    description = i18n._(
                    "Remember you can always search all of " + 
                    "Khan Academy if what you're looking for " + 
                    "is elsewhere.");}

                var boundingBox = 
                $("#top-header-container .nav-search-box")[0].getBoundingClientRect();
                _this3.searchBoxGuider = Guider({ 
                    boundingBox: boundingBox, 
                    position: 6, 
                    content: React.DOM.div(
                    { className: "dashboard-search-callout" }, 
                    description), 
                    onDismissed: function () {return _this3.hideSearchGuider();} });

                _this3.renderSearchBox();});});}, 




    hideSearchGuider: function () {
        this.searchBoxGuider = null;
        this.renderSearchBox();}, 


    /**
     * Contains the many properties necessary to render a user dropdown, namely
     *  1) properties based on the current page (passed in NavHeader.init):
     *      signUpUrl
     *  2) client side user properties (from KA.getUserProfile()):
     *      isPhantom, avatarSrc, nickname
     *  3) server side user properties (passed in to renderUserDropdown):
     *      profileRoot (hard-coded changes if you're in a coach demo?),
     *      showSignUpToSave, showSettings
     */
    _userDropdownContext: null, 

    /**
     * Render the notifications dropdown. Once rendered, it'll still only
     * contain the "loading..." message and throbber. The rest of notifications
     * rendering is handled by the notifications.js package.
     */
    renderNotificationsDropdown: function () {
        if (this._renderedNotificationsDropdown) {
            return;}


        var model = KA.getUserProfile(), 
        count = model ? model.get("countBrandNewNotifications") : 0;

        $("#user-notifications").html(
        require("./notifications-dropdown.handlebars")({ 
            count: count }));


        HeaderTopicBrowser.initDropdownBehavior(
        $("#user-info").find(".dropdown-toggle"));

        this._renderedNotificationsDropdown = true;}, 


    /**
     * Render the new style user dropdown with the hovercard and links to
     * settings and logout.
     * Expects options like:
     *  {
     *      profileRoot: "/profile/nouser/",
     *      showSignUpToSave: true,
     *      showSettings: false
     *  }
     */
    renderUserDropdown: function (options) {
        // If we've already successfully rendered the user dropdown, we don't
        // need to do anything now because avatar/nickname don't tend to change
        // while a page is open (though it would be nice if sometime we could
        // handle the change).
        if (this._renderedUserDropdown) {
            return;}


        // If we don't have the proper info for rendering the dropdown (such as
        // on /embed_video), just bail out. (Only pages that extend
        // page_template.html should need the dropdown anyway.)
        if (!this._userDropdownContext) {
            return;}


        var model = KA.getUserProfile();
        if (!model) {
            return;}


        options = options || {};

        var isPhantom = model.isPhantom();
        if (isPhantom) {
            model.set("nickname", i18n._("Unclaimed points"));}


        // TODO(marcia): If/when we pass cookieless domain to client, use that
        // static url for the avatar src
        var template = require("./user-dropdown.handlebars"), 
        context = { 
            isPhantom: isPhantom, 
            avatarSrc: model.get("avatarSrc"), 
            nickname: model.get("nickname") };


        Object.assign(this._userDropdownContext, context, options);

        if (!this._userDropdownContext["profileRoot"]) {
            this._userDropdownContext["profileRoot"] = model.get(
            "profileRoot");}


        // Render the user dropdown without the hovercard
        // TODO(leah): Maybe go back to server-side rendering of the dropdown
        // menu now that we are no longer rendering the hovercard here.
        $("#user-info").html(template(this._userDropdownContext));

        HeaderTopicBrowser.initDropdownBehavior(
        $("#user-info").find(".dropdown-toggle"));

        bindSignupLink($("#user-info .signup-to-claim"), function () {
            // Close the user dropdown when the signup modal is shown.
            HeaderTopicBrowser.closeTopLevelDropdown();});


        $("#page_logout").click((function () {
            window.location.href = SiteInfra.getLogoutURL();}).
        bind(this));

        $("#top-header").find(".log-in-link").click("click", (function () {
            window.location.href = SiteInfra.getLoginURL();}).
        bind(this));

        this._renderedUserDropdown = true;} };



module.exports = NavHeader;
});
KAdefine("javascript/shared-package/header-topic-browser.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, eqeqeq, no-unused-vars, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var $ = require("jquery");

require("../../third_party/javascript-khansrc/bootstrap-dropdown/dropdown.js");
require("../../third_party/javascript-khansrc/jQuery-menu-aim/jquery.menu-aim.js");

var KA = require("./ka.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;
var ExerciseProgressUtils = require(
"../mobile-shared-package/exercise-progress-utils.js");

var fetchMissionPercentages = function () {
    var val = Promise.all([
    khanFetch("/api/internal/user/missions/progress_info?casing=camel").
    then(function (resp) {return resp.json();}), 
    khanFetch("/api/internal/user/dashboard_options?casing=camel")]).
    then(function (_ref) {var missions = _ref[0];var dashboardOptions = _ref[1];
        var missionPercentages = {};
        missions.forEach(function (mission) {
            var countPerLevel = ExerciseProgressUtils.getCountPerLevel(
            mission.progressInfo);
            var percentage = ExerciseProgressUtils.getProgressPercentage(
            countPerLevel);
            missionPercentages[mission.slug] = percentage;});

        return missionPercentages;});


    // Override the function to avoid multiple calls
    fetchMissionPercentages = function () {return val;};

    return val;};


function fetchAndDisplayMissionPercentages() {
    var $menu = $(".topic-browser-menu");
    var $percents = 
    $menu.find("[data-mission-slug] .topic-browser-mission-percentage");

    var profile = KA.getUserProfile();
    if (!profile || profile.get("isPhantom")) {
        $percents.hide();
        return;}


    // TODO(alpert): If this is called multiple times, we'll end up doing the
    // DOM manipulation here multiple times on the same elements unnecessarily
    fetchMissionPercentages().then(function (missionPercentages) {
        $percents.each(function () {
            var slug = $(this).
            closest("[data-mission-slug]").
            data("missionSlug");
            if (missionPercentages[slug] != null) {
                $(this).text("(" + missionPercentages[slug] + "%)");}});});}





var HeaderTopicBrowser = { 
    init: function () {
        this.initDropdownBehavior($("#top-header").find(".dropdown-toggle"));

        // Responsible for making the experience of scrubbing over domains in
        // the learn menu feel responsive, without overzealously switching the
        // submenu when you are trying to mouse into it
        $(".nav-subheader .topic-browser-menu").menuAim({ 
            submenuSelector: ".has-submenu", 
            activate: function (row) {
                // This gets called when we intentionally hover over a row, and
                // then we do this business so that the submenus' opened state
                // is "sticky" -- an open submenu will stay open until a new
                // submenu replaces it.
                var $newRow = $(row);

                // The previously active row, if it exists
                var $oldRow = $(".hover-active");

                if ($newRow.hasClass("has-submenu")) {
                    // Since we're activating a row with a submenu,
                    // deactivate the old row, which un-highlights the text
                    // and closes its submenu if it exists.
                    $oldRow.removeClass("hover-active");

                    // There's an implicit invariant where a row with a
                    // submenu refers to a domain and thus has a domain
                    // color. So, we update the background color of the
                    // wide container to match.
                    var classNames = "wide-learn-menu-background-container";
                    var $el = $("." + classNames);

                    if ($el.hasClass("on-welcome")) {
                        classNames += " on-welcome";}


                    classNames += " " + $newRow.data("domainSlug");

                    $(".wide-learn-menu-background-container").
                    removeClass().
                    addClass(classNames);} else 
                {
                    // We're activating a row that does *not* have a sub-
                    // menu. Deactivate any other no-submenu rows. We need
                    // the following filter to ensure that the previously
                    // opened submenu remains active / open.
                    $oldRow.filter(function () {
                        return !$(this).hasClass("has-submenu");}).
                    removeClass("hover-active");}


                // Activate our new row
                $newRow.addClass("hover-active");} });}, 





    // Keep track of the active (i.e. opened) top level dropdown, namely
    // the "Learn" menu to the left or the user dropdown to the right.
    _$activeDropdown: null, 
    closeTopLevelDropdown: function () {
        if (this._$activeDropdown) {
            this._$activeDropdown.dropdown("close");
            this._$activeDropdown = null;}}, 



    /**
     * Initialize dropdown menu behavior for the top level navigation.
     * Dropdowns are "click to open," which is the default behavior of calling
     * dropdown(). We ensure all submenus are closed when the top level menu is
     * closed.
     */
    initDropdownBehavior: function ($el) {
        // Filter the list of dropdowns to only those that haven't been init'ed
        // with dropdown behavior yet.
        // This makes this function idempotent so we don't have to worry about
        // when or how we initialize dropdown behavior.
        $el = $el.not("[data-hasDropdownBehavior]");
        $el.
        dropdown().
        on("close", function (e) {
            // TODO(marcia): See TODO below abt that isLearnMenu
            // check. Probably want to set some data attr on the
            // learn menu and instead check that
            var $learnLink = $(e.target).parents(".watch-link");
            var isLearnMenu = $learnLink.length !== 0;
            if (isLearnMenu) {
                // We never want to close the learn menu if it has
                // the "on-welcome" class, which is what happens
                // when the user goes through onboarding on /welcome
                if ($learnLink.hasClass("on-welcome-and-close") || 
                !$learnLink.hasClass("on-welcome")) {
                    $(".wide-learn-menu-background-container").
                    hide().
                    removeClass().
                    addClass(
                    "wide-learn-menu-background-container");

                    $learnLink.find(".dropdown-menu").
                    find(".hover-active").
                    removeClass("hover-active");}}}).



        on("open", function (e) {
            HeaderTopicBrowser.closeTopLevelDropdown();
            HeaderTopicBrowser._$activeDropdown = $(e.target);

            // TODO(marcia): We're initializing all the header
            // dropdowns, and then do something a little special
            // for the learn menu dropdown. Invert the dependency
            // so we don't have to do this type of a check here.
            var $learnLink = $(e.target).parents(".watch-link");
            var isLearnMenu = $learnLink.length !== 0;
            if (isLearnMenu) {
                // Open the math submenu
                $(".topic-browser-menu").
                find(".level0.math").
                addClass("hover-active");


                var classNames = "math";
                if ($learnLink.hasClass("on-welcome")) {
                    classNames += " on-welcome";}

                // Make the wide background math colored too
                $(".wide-learn-menu-background-container").
                show().
                addClass(classNames);

                fetchAndDisplayMissionPercentages();}}).


        end().
        siblings(".dropdown-menu").
        click(function (e) {
            // Override the global HTML click handler bootstrap
            // installs that auto-dismisses the dropdown on any
            // document clicks. We don't want to dismiss the dropdown
            // if the click is inside the dropdown menu itself.
            e.stopPropagation();}).

        end().
        attr("data-hasDropdownBehavior", true).
        attr("role", "button").
        attr("aria-haspopup", "true");}, 


    __fetchMissionPercentagesForTesting: fetchMissionPercentages };


module.exports = HeaderTopicBrowser;
});
KAdefine("javascript/shared-package/responsive-nav-menu.jsx", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable react/forbid-prop-types, comma-dangle, no-trailing-spaces, react/jsx-closing-bracket-location, react/jsx-indent-props, react/jsx-sort-props */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Responsive navigation menu shown on mobile. Includes the learn (subjects)
 * menu.
 */

var React = require("react");
var ReactCSSTransitionGroup = require("react-addons-css-transition-group");
var classNames = require("classnames");

var SiteInfra = require("../shared-package/site-infra.js");
var i18n = require("./i18n.js");

var $_ = i18n.$_;

// TODO(david): Convert desktop wide subject menu to use this as well. This is
//     where the responsive stuff actually comes in! But doing this may affect
//     SEO due to the client-side generated nav. Desmond is 90% sure that such
//     a replacement would negatively affect SEO. Jamie links to this article:
//     http://engineering.pinterest.com/post/109318939139
//     If we do decide to do this, we may want to serve up a bot-only view of
//     the menu (easy), serve up React on the server side (hard), or use
//     phantomjs to scrape our site.
// TODO(david): Link to missions (and add mission %ages) when logged in?

var domainObjectPropType = React.PropTypes.shape({ 
    translatedTitle: React.PropTypes.string.isRequired, 
    identifier: React.PropTypes.string.isRequired, 
    href: React.PropTypes.string, 
    children: React.PropTypes.arrayOf(React.PropTypes.shape({ 
        identifier: React.PropTypes.string.isRequired, 
        translatedTitle: React.PropTypes.string.isRequired, 
        href: React.PropTypes.string })) });



/**
 * Group a domain's children. Each group has an identifier, title, and subset
 * of the children from that domain. Returns the following format:
 * [{ identifier: <string>, title: <string>, children: <array> }, ... ]
 *
 * This is all done via ugly special-casing, mirroring
 * topic-browser-pulldown.handlebars. Hopefully, this React menu will
 * eventually replace the latter file. If not, we should return a consistent
 * format from the server in templatetags.topic_browser_data.
 */
var transformDomainIntoSubgroups = function (domain) {
    // NOTE: Please keep in sync with topic-browser-pulldown.handlebars.

    var domainIdentifier = domain.identifier;

    if (domainIdentifier === "math") {
        var childrenByGradeLevel = domain.childrenByGradeLevel;
        return ["grades", "secondary", "fundamentals"].
        map(function (identifier) {
            var child = childrenByGradeLevel[identifier];
            if (child) {
                return { 
                    identifier: identifier, 
                    title: child.header, 
                    children: child.children };}}).



        filter(function (item) {return item;}); // Remove falsey values
    } else if (domainIdentifier === "humanities") {
        return [{ 
            identifier: "other-humanities", 
            title: i18n._("Humanities"), 
            children: domain.otherHumanitiesChildren }, 
        { 
            identifier: "art-history", 
            title: i18n._("Art history"), 
            children: domain.artHistoryChildren }];} else 

    if (domainIdentifier === "partner-content") {
        return [{ 
            identifier: "museum", 
            title: i18n._("Museums"), 
            children: domain.museumChildren }, 
        { 
            identifier: "other-partner-content", 
            title: i18n._("Partners"), 
            children: domain.otherPartnerContentChildren }];} else 

    {
        return [{ 
            identifier: domain.identifier, 
            title: i18n._("Subjects"), 
            children: domain.children }];}};




/**
 * A component for a top-level section of the menu, like the Science domain.
 * Might not be a domain with children, like "Talks and interviews."
 */
var NavMenuSection = React.createClass({ displayName: "NavMenuSection", 
    propTypes: { 
        domain: domainObjectPropType }, 


    getInitialState: function () {
        return { 
            open: false };}, 



    handleSectionTitleClick: function () {
        this.setState({ open: !this.state.open });}, 


    render: function () {
        var domain = this.props.domain;
        var hasChildren = domain && !!domain.children.length;

        var domainSubgroups = transformDomainIntoSubgroups(domain);
        var domainSubgroupElements = domainSubgroups.map(function (subgroup) {
            var children = subgroup.children && 
            subgroup.children.map(function (child) {return (
                React.createElement("li", { key: child.identifier }, 
                React.createElement("a", { href: child.href, className: "nav-section-content-text" }, 
                child.translatedTitle)));});




            return React.createElement("li", { key: subgroup.identifier, className: "domain-subgroup" }, 
            React.createElement("div", { className: "domain-subgroup-title" }, subgroup.title), 
            React.createElement("ul", null, children));});



        var sectionIcon = null;
        if (hasChildren) {
            var className = classNames({ 
                "nav-section-icon": true, 
                "icon-angle-right": true, 
                "nav-section-opened": this.state.open });

            sectionIcon = React.createElement("i", { className: className });}


        var identifier = domain.identifier;

        return React.createElement("li", { className: "nav-menu-section" }, 
        React.createElement("a", { className: "nav-section-title " + identifier, 
            "data-test-id": "" + identifier + "-mobile-nav-link", 
            href: hasChildren ? null : domain.href, 
            onClick: this.handleSectionTitleClick }, 
        domain.translatedTitle, 
        sectionIcon), 

        React.createElement(ReactCSSTransitionGroup, { 
            transitionName: "nav-section", 
            transitionEnterTimeout: 250, 
            transitionLeaveTimeout: 250 }, 
        hasChildren && this.state.open && 
        React.createElement("ul", { key: identifier, className: "nav-section-contents " + 
            identifier, 
            "data-test-id": "" + identifier + "-mobile-nav-section" }, 
        domainSubgroupElements)));} });







/**
 * A responsive navigation menu shown on small screens. Includes the
 * subjects/learn menu. Eventually we want to consolidate the wide subject menu
 * into this as well.
 */
var ResponsiveNavMenu = React.createClass({ displayName: "ResponsiveNavMenu", 
    propTypes: { 
        domains: React.PropTypes.arrayOf(domainObjectPropType), 
        profileModel: React.PropTypes.object }, 


    handleLogin: function (e) {
        e.preventDefault();
        window.location.href = SiteInfra.getLoginURL();}, 


    handleLogout: function (e) {
        e.preventDefault();
        window.location.href = SiteInfra.getLogoutURL();}, 


    render: function () {
        var profile = this.props.profileModel;
        var isLoggedIn = !!profile && !profile.isPhantom();
        var domains = this.props.domains.map(function (domain) {
            return React.createElement(NavMenuSection, { 
                key: domain.identifier, 
                domain: domain });});



        return React.createElement("div", null, 
        React.createElement("ul", null, 
        !isLoggedIn && 
        React.createElement("li", { className: "nav-menu-section" }, 
        React.createElement("a", { className: "nav-section-title login-link", 
            href: "#", 
            onClick: this.handleLogin }, 
        $_(null, "Log in / Sign up"))), 



        domains, 
        !isLoggedIn && 
        React.createElement("li", { className: "nav-menu-section" }, 
        React.createElement("a", { className: "nav-section-title informational-link", 
            href: "/about" }, 


        React.createElement("span", { "aria-hidden": "true" }, $_(null, "About")), 
        React.createElement("span", { className: "sr-only" }, 
        $_(null, "About Khan Academy")))), 




        !isLoggedIn && 
        React.createElement("li", { className: "nav-menu-section" }, 
        React.createElement("a", { className: "nav-section-title informational-link", 
            href: "/donate" }, 
        $_(null, "Donate"))), 



        isLoggedIn && 
        React.createElement("li", { className: "nav-menu-section clearfix" }, 
        React.createElement("a", { className: "nav-section-title profile-link", 
            href: profile.get("profileRoot") }, 
        React.createElement("img", { className: "user-avatar", 
            src: profile.get("avatarSrc") }), 
        profile.get("nickname")), 

        React.createElement("a", { className: "nav-section-title logout-link", 
            href: "#", 
            onClick: this.handleLogout }, 
        $_(null, "Log out")))));} });








module.exports = ResponsiveNavMenu; /* Two sections, one for screens, and one for
                                       screen readers */
});
KAdefine("javascript/shared-package/nav-footer.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-trailing-spaces */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Handle site wide navigation, including rendering and interacting with the
 * footer.
 *
 * TODO(marcia): I had named this file ka-nav.js to distinguish it from
 * tutorial-nav.js, but then I learned that there is also a khan-nav.js. That
 * is super confusing and we should rename these files more clearly!
 *
 * TODO(stephanie): Refactored ka-nav.js into two separate files, nav-
 * header.js and nav-footer.js, on 2013-12-18 as part of FIXIT VII (Santa
 * Isn't Real), but still has same issues as above...
 */

require("../../third_party/javascript-khansrc/jqueryui/jquery.ui.effect.js");
var $ = require("jquery");
var _ = require("../../third_party/javascript-khansrc/lodash/lodash.js");

require("./jquery.delayload.js");
var KA = require("./ka.js");

var NavFooter = { 
    // make links at bottom of page scroll you to the bottom
    init: function () {
        if (!KA.isMobileCapable) {
            var visibleLinks = $("footer li.heading:first-child");
            visibleLinks.addClass("footer-scroll-cue");

            visibleLinks.on("click", function () {
                var bottomOfPageOffset = $(document).height() - $(window).height();
                $("html, body").animate({ "scrollTop": bottomOfPageOffset }, 360, "easeInOutCubic");});}



        // We delay load the footer image for performance reasons,
        // since it is often not visible
        var maybeLoadFooterImage = function (nearThreshold) {
            $("#footer [data-delayed-src]").each(function () {
                if ($(this).delayLoad(nearThreshold)) {
                    $(window).off("scroll.load-footer-image");}});};



        // On scroll, use a small-ish threshold. We don't care about
        // footer image that much.
        $(window).on("scroll.load-footer-image", _.throttle(function () {
            maybeLoadFooterImage(200);}, 
        300));
        // Only load at first if its visible
        maybeLoadFooterImage();} };



module.exports = NavFooter;
});
KAdefine("third_party/javascript-khansrc/Guiders-JS/guiders.js", function(__KA_require, __KA_module, __KA_exports) {
__KA_require("../../../javascript/node_modules/jquery/index.js");
/**
 * guiders.js
 *
 * Modified for use by Khan Academy.
 * Based on guiders.js v1.2.0:
 *
 * Developed at Optimizely. (www.optimizely.com)
 * We make A/B testing you'll actually use.
 *
 * Released under the Apache License 2.0.
 * www.apache.org/licenses/LICENSE-2.0.html
 *
 * Questions about Guiders or Optimizely?
 * Email us at jeff+pickhardt@optimizely.com or hello@optimizely.com.
 *
 * Enjoy!
 */

window.guiders = (function($) {
  var guiders = {};

  guiders.ButtonAction = {
    NEXT: 0,
    CLOSE: 1
  };

  guiders._defaultSettings = {
    attachTo: null,
    buttons: [{
        action: guiders.ButtonAction.CLOSE,
        text: "Close"
    }],
    buttonCustomHTML: "",
    classString: null,
    description: "",
    highlight: null,
    isHashable: true,
    offset: {
        top: null,
        left: null
    },
    onShow: null,
    overlay: false,
    position: 0, // 1-12 follows an analog clock, 0 means centered
    title: "Sample title goes here",
    width: 400,
    xButton: false // this places a closer "x" button in the top right of the guider
  };

  guiders._htmlSkeleton = [
    "<div class='guider' role='dialog' tabindex='-1' ",
          "aria-labelledby='guider_title'>",
    "  <div class='guider_content'>",
    "    <div id='guider_title' class='guider_title'></div>",
    "    <div class='guider_close'></div>",
    "    <div class='guider_description'></div>",
    "    <div class='guider_buttons'>",
    "    </div>",
    "  </div>",
    "  <div class='guider_arrow'>",
    "  </div>",
    "</div>"
  ].join("");

  guiders._arrowSize = 42; // = arrow's width and height
  guiders._currentGuiderID = null;
  guiders._guiders = {};
  guiders._lastCreatedGuiderID = null;

  // Must be above the guider_overlay, but below the click_mask.
  guiders._zIndexForHighlight = 1031;

  guiders._addButtons = function(myGuider) {
    // Add buttons
    var guiderButtonsContainer = myGuider.elem.find(".guider_buttons");

    if (myGuider.buttons === null || myGuider.buttons.length === 0) {
      guiderButtonsContainer.remove();
      return;
    }

    for (var i = myGuider.buttons.length-1; i >= 0; i--) {
      var thisButton = myGuider.buttons[i];
      var thisButtonElem = $("<a></a>", {
                              "href" : thisButton.href || "#",
                              "class" : "ka_guider_button",
                              "role" : "button",
                              "text" : thisButton.text });
      if (typeof thisButton.classString !== "undefined" && thisButton.classString !== null) {
        thisButtonElem.addClass(thisButton.classString);
      }

      guiderButtonsContainer.append(thisButtonElem);

      if (thisButton.onclick) {
        thisButtonElem.bind("click", thisButton.onclick);
      } else if (!thisButton.onclick &&
                 thisButton.action === guiders.ButtonAction.CLOSE) {
        thisButtonElem.bind("click", function() { guiders.hideAll(); });
      } else if (!thisButton.onclick &&
                 thisButton.action === guiders.ButtonAction.NEXT) {
        thisButtonElem.bind("click", function() { guiders.next(); });
      }
    }

    if (myGuider.buttonCustomHTML !== "") {
      var myCustomHTML = $(myGuider.buttonCustomHTML);
      myGuider.elem.find(".guider_buttons").append(myCustomHTML);
    }

    if (myGuider.buttons.length == 0) {
        guiderButtonsContainer.remove();
    }
  };

  guiders._addXButton = function(myGuider) {
      var xButtonContainer = myGuider.elem.find(".guider_close");
      var xButton = $("<div></div>", {
                      "href" : "#",
                      "class" : "x_button",
                      "role" : "button" });
      xButtonContainer.append(xButton);
      xButton.click(function() { guiders.hideAll(); });
  };

  guiders._attach = function(myGuider) {
    if (myGuider === null) {
      return;
    }

    var myHeight = myGuider.elem.innerHeight();
    var myWidth = myGuider.elem.innerWidth();

    if (myGuider.position === 0 || myGuider.attachTo === null) {
      myGuider.elem.css("position", "absolute");
      myGuider.elem.css("top", ($(window).height() - myHeight) / 3 + $(window).scrollTop() + "px");
      myGuider.elem.css("left", ($(window).width() - myWidth) / 2 + $(window).scrollLeft() + "px");
      return;
    }

    myGuider.attachTo = $(myGuider.attachTo);
    var base = myGuider.attachTo.offset();
    var attachToHeight = myGuider.attachTo.innerHeight();
    var attachToWidth = myGuider.attachTo.innerWidth();

    var top = base.top;
    var left = base.left;

    var bufferOffset = 0.9 * guiders._arrowSize;

    var offsetMap = { // Follows the form: [height, width]
      1: [-bufferOffset - myHeight, attachToWidth - myWidth],
      2: [0, bufferOffset + attachToWidth],
      3: [attachToHeight/2 - myHeight/2, bufferOffset + attachToWidth],
      4: [attachToHeight - myHeight, bufferOffset + attachToWidth],
      5: [bufferOffset + attachToHeight, attachToWidth - myWidth],
      6: [bufferOffset + attachToHeight, attachToWidth/2 - myWidth/2],
      7: [bufferOffset + attachToHeight, 0],
      8: [attachToHeight - myHeight, -myWidth - bufferOffset],
      9: [attachToHeight/2 - myHeight/2, -myWidth - bufferOffset],
      10: [0, -myWidth - bufferOffset],
      11: [-bufferOffset - myHeight, 0],
      12: [-bufferOffset - myHeight, attachToWidth/2 - myWidth/2]
    };

    offset = offsetMap[myGuider.position];
    top   += offset[0];
    left  += offset[1];

    if (myGuider.offset.top !== null) {
      top += myGuider.offset.top;
    }

    if (myGuider.offset.left !== null) {
      left += myGuider.offset.left;
    }

    myGuider.elem.css({
      "position": "absolute",
      "top": top,
      "left": left
    });
  };

  guiders._guiderById = function(id) {
    if (typeof guiders._guiders[id] === "undefined") {
      throw new Error("Cannot find guider with id " + id);
    }
    return guiders._guiders[id];
  };

  guiders._showOverlay = function() {
    $("#guider_overlay").fadeIn("fast", function(){
      if (this.style.removeAttribute) {
        this.style.removeAttribute("filter");
      }
      $("#guider_click_mask").show();
    });
    // This callback is needed to fix an IE opacity bug.
    // See also:
    // http://www.kevinleary.net/jquery-fadein-fadeout-problems-in-internet-explorer/
  };

  guiders._highlightElement = function(selector) {
    $(selector).css({'z-index': guiders._zIndexForHighlight});
  };

  guiders._dehighlightElement = function(selector) {
    $(selector).css({'z-index': ''});
  };

  guiders._hideOverlay = function() {
    $("#guider_overlay").fadeOut("fast");
    $("#guider_click_mask").hide();

    $(document).off("focusin.guider.modal");
  };

  guiders._initializeOverlay = function() {
    if ($("#guider_overlay").length === 0) {
      // The guider_overlay provides the tinting effect.
      $("<div id=\"guider_overlay\"></div>").hide().appendTo("body");
      // The click mask captures events so that highlighted elements
      // can't be interacted with mid-flow.
      $("<div id=\"guider_click_mask\"></div>").hide().click(function(e) {
        e.preventDefault();
        e.stopPropagation();
      }).appendTo("body");
    }
  };

  guiders._styleArrow = function(myGuider) {
    var position = myGuider.position || 0;
    if (!position) {
      return;
    }
    var myGuiderArrow = $(myGuider.elem.find(".guider_arrow"));
    var newClass = {
      1: "guider_arrow_down",
      2: "guider_arrow_left",
      3: "guider_arrow_left",
      4: "guider_arrow_left",
      5: "guider_arrow_up",
      6: "guider_arrow_up",
      7: "guider_arrow_up",
      8: "guider_arrow_right",
      9: "guider_arrow_right",
      10: "guider_arrow_right",
      11: "guider_arrow_down",
      12: "guider_arrow_down"
    };
    myGuiderArrow.addClass(newClass[position]);

    var myHeight = myGuider.elem.innerHeight();
    var myWidth = myGuider.elem.innerWidth();
    var arrowOffset = guiders._arrowSize / 2;
    var positionMap = {
      1: ["right", arrowOffset],
      2: ["top", arrowOffset],
      3: ["top", myHeight/2 - arrowOffset],
      4: ["bottom", arrowOffset],
      5: ["right", arrowOffset],
      6: ["left", myWidth/2 - arrowOffset],
      7: ["left", arrowOffset],
      8: ["bottom", arrowOffset],
      9: ["top", myHeight/2 - arrowOffset],
      10: ["top", arrowOffset],
      11: ["left", arrowOffset],
      12: ["left", myWidth/2 - arrowOffset]
    };
    var position = positionMap[myGuider.position];
    myGuiderArrow.css(position[0], position[1] + "px");
  };

  /**
   * One way to show a guider to new users is to direct new users to a URL such as
   * http://www.mysite.com/myapp#guider=welcome
   *
   * This can also be used to run guiders on multiple pages, by redirecting from
   * one page to another, with the guider id in the hash tag.
   *
   * Alternatively, if you use a session variable or flash messages after sign up,
   * you can add selectively add JavaScript to the page: "guiders.show('first');"
   */
  guiders._showIfHashed = function(myGuider) {
    var GUIDER_HASH_TAG = "guider=";
    var hashIndex = window.location.hash.indexOf(GUIDER_HASH_TAG);
    if (hashIndex !== -1) {
      var hashGuiderId = window.location.hash.substr(hashIndex + GUIDER_HASH_TAG.length);
      if (myGuider.id.toLowerCase() === hashGuiderId.toLowerCase()) {
        // Success!
        guiders.show(myGuider.id);
      }
    }
  };

  guiders.next = function() {
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    if (typeof currentGuider === "undefined") {
      return;
    }
    var nextGuiderId = currentGuider.next || null;
    if (nextGuiderId !== null && nextGuiderId !== "") {
      var myGuider = guiders._guiderById(nextGuiderId);
      var omitHidingOverlay = myGuider.overlay ? true : false;
      guiders.hideAll(omitHidingOverlay);
      guiders.show(nextGuiderId);
    }
  };

  guiders.createGuider = function(passedSettings) {
    if (passedSettings === null || passedSettings === undefined) {
      passedSettings = {};
    }

    // Extend those settings with passedSettings
    myGuider = $.extend({}, guiders._defaultSettings, passedSettings);
    myGuider.id = myGuider.id || String(Math.floor(Math.random() * 1000));

    var guiderElement = $(guiders._htmlSkeleton);
    myGuider.elem = guiderElement;
    if (typeof myGuider.classString !== "undefined" && myGuider.classString !== null) {
      myGuider.elem.addClass(myGuider.classString);
    }
    myGuider.elem.css("width", myGuider.width + "px");

    var guiderTitleContainer = guiderElement.find(".guider_title");
    guiderTitleContainer.html(myGuider.title);

    guiderElement.find(".guider_description").html(myGuider.description);

    guiders._addButtons(myGuider);

    if (myGuider.xButton) {
        guiders._addXButton(myGuider);
    }

    guiderElement.hide();
    guiderElement.appendTo("body");
    guiderElement.attr("id", myGuider.id);

    // Ensure myGuider.attachTo is a jQuery element.
    if (typeof myGuider.attachTo !== "undefined" && myGuider !== null) {
      guiders._attach(myGuider);
      guiders._styleArrow(myGuider);
    }

    guiders._initializeOverlay();

    guiders._guiders[myGuider.id] = myGuider;
    guiders._lastCreatedGuiderID = myGuider.id;

    /**
     * If the URL of the current window is of the form
     * http://www.myurl.com/mypage.html#guider=id
     * then show this guider.
     */
    if (myGuider.isHashable) {
      guiders._showIfHashed(myGuider);
    }

    return guiders;
  };

  guiders.hideAll = function(omitHidingOverlay) {
    var currentGuider = guiders._guiders[guiders._currentGuiderID];
    if (currentGuider && currentGuider.highlight) {
      guiders._dehighlightElement(currentGuider.highlight);
    }

    $(".guider").fadeOut("fast");
    if (typeof omitHidingOverlay !== "undefined" && omitHidingOverlay === true) {
      // do nothing for now
    } else {
      guiders._hideOverlay();
    }
    return guiders;
  };

  guiders.show = function(id) {
    if (!id && guiders._lastCreatedGuiderID) {
      id = guiders._lastCreatedGuiderID;
    }

    var myGuider = guiders._guiderById(id);
    if (myGuider.overlay) {
      guiders._showOverlay();
      // if guider is attached to an element, make sure it's visible
      if (myGuider.highlight) {
        guiders._highlightElement(myGuider.highlight);
      }
    }

    guiders._attach(myGuider);

    // You can use an onShow function to take some action before the guider is shown.
    if (myGuider.onShow) {
      myGuider.onShow(myGuider);
    }

    myGuider.elem.fadeIn("fast");
    myGuider.elem.focus();

    // From Bootstrap's Modal
    // Force the focus to be inside the modal, not in the rest of the page.
    // Only do this if this guider is meant to act as a modal, which we
    // infer from whether an overlay is shown.
    if (myGuider.overlay) {
        $(document)
            .off("focusin.guider.modal") // guard against infinite focus loop
            .on("focusin.guider.modal", function (e) {
                if (myGuider.elem[0] !== e.target &&
                    !myGuider.elem.has(e.target).length) {
                    myGuider.elem.focus();
                }
            });
    }

    var windowHeight = $(window).height();
    var scrollHeight = $(window).scrollTop();
    var guiderOffset = myGuider.elem.offset();
    var guiderElemHeight = myGuider.elem.height();

    if (guiderOffset.top - scrollHeight < 0 ||
        guiderOffset.top + guiderElemHeight + 40 > scrollHeight + windowHeight) {
      window.scrollTo(0, Math.max(guiderOffset.top + (guiderElemHeight / 2) - (windowHeight / 2), 0));
    }

    guiders._currentGuiderID = id;
    return guiders;
  };

  return guiders;
}).call(this, jQuery);
__KA_module.exports = guiders;
this.guiders = guiders;
});
KAdefine("javascript/shared-package/exercise-progress-constants.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Enums of possible exercise progress level names, in sync with server's
 * exercise_models.ExerciseProgress and also kept in sync with
 * javascript/mobile-shared-package/exercise-progress-constants.js.
 * TODO(alpert): Remove this duplication after making i18n work without jQuery
 */

"use strict";

var i18n = require("./i18n.js");

var ExerciseProgressConstants = { 
    LEVEL_NAMES: [
    "unstarted", 
    "practiced", 
    "mastery1", 
    "mastery2", 
    "mastery3"], 

    LEVEL_SLUGS: { 
        "unstarted": i18n._("Needs Practice"), 
        "practiced": i18n._("Practiced"), 
        "mastery1": i18n._("Level One"), 
        "mastery2": i18n._("Level Two"), 
        "mastery3": i18n._("Mastered") }, 

    LEVEL_VALUES: { 
        "unstarted": 0, 
        "practiced": 1, 
        "mastery1": 2, 
        "mastery2": 3, 
        "mastery3": 4 } };



module.exports = ExerciseProgressConstants;
});
KAdefine("javascript/mobile-shared-package/exercise-progress-constants.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Version of javascript/shared-package/exercise-progress-constants.js without
 * LEVEL_SLUGS because i18n doesn't work without jQuery, which we can't use on
 * mobile currently.
 * TODO(alpert): Remove this duplication after making i18n work without jQuery
 */

"use strict";

var ExerciseProgressConstants = { 
    LEVEL_NAMES: [
    "unstarted", 
    "practiced", 
    "mastery1", 
    "mastery2", 
    "mastery3"], 

    // TODO(alpert): Bring back LEVEL_SLUGS (i18n currently not possible
    // because jQuery throws errors in a vanilla JSC context)
    LEVEL_VALUES: { 
        "unstarted": 0, 
        "practiced": 1, 
        "mastery1": 2, 
        "mastery2": 3, 
        "mastery3": 4 } };



module.exports = ExerciseProgressConstants;
});
KAdefine("javascript/mobile-shared-package/exercise-progress-utils.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle */
/* To fix, remove an entry above, run "make linc", and fix errors. */

"use strict";

var ExerciseProgressConstants = require("./exercise-progress-constants.js");

/**
 * Given a mission progressInfo array, return the counts of exercises at each
 * level: unstarted, practiced, mastery1, mastery2, or mastery 3. For the math
 * mission, all exercises are core exercises, whereas the other missions have a
 * distinction between core and prerequisite exercises.
 * Return a dictionary of the form: {
 *      "unstarted": <count>,
 *      "practiced": <count>,
 *      ... for each level in ExerciseProgressConstants.LEVEL_NAMES
 *      }
 */
function getCountPerLevel(progressInfo) {
    var countPerLevel = {};
    ExerciseProgressConstants.LEVEL_NAMES.forEach(function (level) {
        countPerLevel[level] = 0;});


    // Count all exercises, in other words prereq and core exercises
    (progressInfo || []).forEach(function (progress) {
        countPerLevel[progress.state]++;});


    return countPerLevel;}


/**
 * Get the progress percentage, where each level of progress is weighted
 * more than the previous level.
 *
 * For each skill, you receive between 0 and 4 units of progress. 0 for
 * unstarted, 1 for practiced, 2 for level1, 3 for level2, and 4 for
 * mastery.
 *
 * So mastering a mission with N skills would yield N * 4 progress units
 * out of the possible N * 4, and this would return 100.
 *
 * Note that there is more than one way to get a particular progress %. For
 * example, to receive 25% here, you could either master 1/4 of the skills
 * OR you could practice all N skills.
 *
 * @param {Object} countPerLevel Map of count per progress level, as returned
 *     from getCountPerLevel
 */
function getProgressPercentage(countPerLevel) {
    var progress = countPerLevel["mastery3"] * 4 + 
    countPerLevel["mastery2"] * 3 + 
    countPerLevel["mastery1"] * 2 + 
    countPerLevel["practiced"] * 1 + 
    countPerLevel["unstarted"] * 0;

    var total = countPerLevel["mastery3"] * 4 + 
    countPerLevel["mastery2"] * 4 + 
    countPerLevel["mastery1"] * 4 + 
    countPerLevel["practiced"] * 4 + 
    countPerLevel["unstarted"] * 4;

    return Math.floor(100 * progress / total);}


/**
 * A comparator function comparing two progress values using
 * ExerciseProgressConstants.LEVEL_VALUES
 *
 * @param {String} a, b: a string from ExerciseProgressConstants.LEVEL_NAMES
 *
 * @returns {Number} a number which can be consumed by Array.prototype.sort
 */
var progressCompare = function (a, b) {
    return ExerciseProgressConstants.LEVEL_VALUES[a] - 
    ExerciseProgressConstants.LEVEL_VALUES[b];};


var ExerciseProgressUtils = { 
    getCountPerLevel: getCountPerLevel, 
    getProgressPercentage: getProgressPercentage, 
    progressCompare: progressCompare };


module.exports = ExerciseProgressUtils;
});
KAdefine("javascript/shared-package/visit-tracking.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Tracking of return visits for logged-in, phantom, and pre-phantom users.
 */

var BigBingo = require("./bigbingo.js");
var Cookies = require("./cookies.js");
var KA = require("./ka.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;var formUrlencode = _require.formUrlencode;

// TODO(stephanie): do this in a more appropriate common library
var getSeconds = function (dateString) {
    var date = new Date();
    if (dateString) {
        date = new Date(dateString);}

    return Math.floor(+date / 1000);};


var returnVisitTime = 60 * 60 * 3; // 3 hours to be return visit
var keepCookieFor = 365 * 2; // Keep the cookie for at most 2 years
var frequency = 60 * 30; // Only update at most once/30 min

var VisitTracking = { 
    _serverPageLoadTime: null, 
    _browserPageLoadTime: null, 

    _init: function () {
        // Only execute this, at most, once
        if (this._initDone) {
            return;}


        this._initDone = true;

        VisitTracking._serverPageLoadTime = KA.currentServerTime();
        VisitTracking._browserPageLoadTime = getSeconds();}, 


    trackVisit: function () {
        if (!KA.INITIALIZED || !Cookies.areCookiesEnabled()) {
            return;}


        VisitTracking._init();

        var curID = KA.getUserID();
        var encCurID = encodeURIComponent(curID);

        var curTime = getSeconds();
        var secondsSincePageLoad = curTime - VisitTracking._browserPageLoadTime;
        var curServerTime = VisitTracking._serverPageLoadTime + 
        secondsSincePageLoad;

        /**
          * Update our cookie that keeps track of the last time we've visited.
          */
        function updateReturnVisitCookie() {
            Cookies.createCookie("return_visits_" + encCurID, curServerTime, 
            keepCookieFor);}


        /**
          * Send the server a bingo recording a return visit for the currently
          * logged-in user.
          */
        function _bingoReturnVisit() {
            var userType = "";
            if (!curID) {
                userType = "pre_phantom";} else 
            if (KA.getUserProfile().isPhantom()) {
                userType = "phantom";} else 
            {
                userType = "logged_in";}


            var conversions = [
            "return_visit", // Core metric
            userType + "_return_visit" // Core metric
            ];

            // bingo if this return visit is within 7 days of registering
            var user = KA.getUserProfile();
            if (user && !user.attributes.isPhantom) {
                var dateJoined = getSeconds(user.attributes.dateJoined);
                if (curTime - dateJoined < 60 * 60 * 24 * 7) {
                    conversions.push("logged_in_return_visit_7_day");}}



            if (user && user.attributes.isChildAccount) {
                khanFetch(
                "/api/internal/user/mark_bingo_conversion_for_parent", 
                { 
                    method: "POST", 
                    body: formUrlencode({ 
                        conversion_id: "child_return_visit" }) });}




            BigBingo.markConversions(conversions);
            updateReturnVisitCookie();}


        // Last visit time stored in cookie as seconds since server epoch
        var lastVisit = +Cookies.readCookie("return_visits_" + encCurID);

        if (!lastVisit) {
            // Reset cookie (it's corrupt or not there yet)
            updateReturnVisitCookie();
            return;}


        var secondsSinceVisit = curServerTime - lastVisit;

        if (secondsSinceVisit > returnVisitTime) {

            // Return visit! Cookie hasn't been updated in more than
            // returnVisitTime seconds.
            //
            // Tell server, and only then update cookie.
            //
            // Wait 30s to let more important JS on the page run. If user leaves
            // this page before 30s is up, they'll get a chance to log a return
            // visit on the next page. If they never sit on a single page for >= 30
            // seconds, we won't record a return visit.
            setTimeout(_bingoReturnVisit, 30000);} else 

        if (secondsSinceVisit > frequency) {

            // Not a return visit, and cookie hasn't been updated in more than
            // frequency seconds. Just update cookie.
            //
            // This is the equivalent of continuing a previous session instead of
            // counting it as a new return visit.
            updateReturnVisitCookie();}} };




module.exports = VisitTracking;
});
KAdefine("third_party/javascript-khansrc/seedrandom/seedrandom.js", function(__KA_require, __KA_module, __KA_exports) {
/**

seedrandom.js
=============

Seeded random number generator for Javascript.

version 2.3.6
Author: David Bau
Date: 2014 May 14

Can be used as a plain script, a node.js module or an AMD module.

Script tag usage
----------------

<script src=//cdnjs.cloudflare.com/ajax/libs/seedrandom/2.3.6/seedrandom.min.js>
</script>

// Sets Math.random to a PRNG initialized using the given explicit seed.
Math.seedrandom('hello.');
console.log(Math.random());          // Always 0.9282578795792454
console.log(Math.random());          // Always 0.3752569768646784

// Sets Math.random to an ARC4-based PRNG that is autoseeded using the
// current time, dom state, and other accumulated local entropy.
// The generated seed string is returned.
Math.seedrandom();
console.log(Math.random());          // Reasonably unpredictable.

// Seeds using the given explicit seed mixed with accumulated entropy.
Math.seedrandom('added entropy.', { entropy: true });
console.log(Math.random());          // As unpredictable as added entropy.

// Use "new" to create a local prng without altering Math.random.
var myrng = new Math.seedrandom('hello.');
console.log(myrng());                // Always 0.9282578795792454


Node.js usage
-------------

npm install seedrandom

// Local PRNG: does not affect Math.random.
var seedrandom = require('seedrandom');
var rng = seedrandom('hello.');
console.log(rng());                  // Always 0.9282578795792454

// Autoseeded ARC4-based PRNG.
rng = seedrandom();
console.log(rng());                  // Reasonably unpredictable.

// Global PRNG: set Math.random.
seedrandom('hello.', { global: true });
console.log(Math.random());          // Always 0.9282578795792454

// Mixing accumulated entropy.
rng = seedrandom('added entropy.', { entropy: true });
console.log(rng());                  // As unpredictable as added entropy.


Require.js usage
----------------

Similar to node.js usage:

bower install seedrandom

require(['seedrandom'], function(seedrandom) {
  var rng = seedrandom('hello.');
  console.log(rng());                  // Always 0.9282578795792454
});


Network seeding via a script tag
--------------------------------

<script src=//cdnjs.cloudflare.com/ajax/libs/seedrandom/2.3.6/seedrandom.min.js>
</script>
<!-- Seeds using urandom bits from a server. -->
<script src=//jsonlib.appspot.com/urandom?callback=Math.seedrandom">
</script>

Examples of manipulating the seed for various purposes:

var seed = Math.seedrandom();        // Use prng with an automatic seed.
document.write(Math.random());       // Pretty much unpredictable x.

var rng = new Math.seedrandom(seed); // A new prng with the same seed.
document.write(rng());               // Repeat the 'unpredictable' x.

function reseed(event, count) {      // Define a custom entropy collector.
  var t = [];
  function w(e) {
    t.push([e.pageX, e.pageY, +new Date]);
    if (t.length < count) { return; }
    document.removeEventListener(event, w);
    Math.seedrandom(t, { entropy: true });
  }
  document.addEventListener(event, w);
}
reseed('mousemove', 100);            // Reseed after 100 mouse moves.

The "pass" option can be used to get both the prng and the seed.
The following returns both an autoseeded prng and the seed as an object,
without mutating Math.random:

var obj = Math.seedrandom(null, { pass: function(prng, seed) {
  return { random: prng, seed: seed };
}});


Version notes
-------------

The random number sequence is the same as version 1.0 for string seeds.
* Version 2.0 changed the sequence for non-string seeds.
* Version 2.1 speeds seeding and uses window.crypto to autoseed if present.
* Version 2.2 alters non-crypto autoseeding to sweep up entropy from plugins.
* Version 2.3 adds support for "new", module loading, and a null seed arg.
* Version 2.3.1 adds a build environment, module packaging, and tests.
* Version 2.3.4 fixes bugs on IE8, and switches to MIT license.
* Version 2.3.6 adds a readable options object argument.

The standard ARC4 key scheduler cycles short keys, which means that
seedrandom('ab') is equivalent to seedrandom('abab') and 'ababab'.
Therefore it is a good idea to add a terminator to avoid trivial
equivalences on short string seeds, e.g., Math.seedrandom(str + '\0').
Starting with version 2.0, a terminator is added automatically for
non-string seeds, so seeding with the number 111 is the same as seeding
with '111\0'.

When seedrandom() is called with zero args or a null seed, it uses a
seed drawn from the browser crypto object if present.  If there is no
crypto support, seedrandom() uses the current time, the native rng,
and a walk of several DOM objects to collect a few bits of entropy.

Each time the one- or two-argument forms of seedrandom are called,
entropy from the passed seed is accumulated in a pool to help generate
future seeds for the zero- and two-argument forms of seedrandom.

On speed - This javascript implementation of Math.random() is several
times slower than the built-in Math.random() because it is not native
code, but that is typically fast enough.  Some details (timings on
Chrome 25 on a 2010 vintage macbook):

* seeded Math.random()          - avg less than 0.0002 milliseconds per call
* seedrandom('explicit.')       - avg less than 0.2 milliseconds per call
* seedrandom('explicit.', true) - avg less than 0.2 milliseconds per call
* seedrandom() with crypto      - avg less than 0.2 milliseconds per call

Autoseeding without crypto is somewhat slower, about 20-30 milliseconds on
a 2012 windows 7 1.5ghz i5 laptop, as seen on Firefox 19, IE 10, and Opera.
Seeded rng calls themselves are fast across these browsers, with slowest
numbers on Opera at about 0.0005 ms per seeded Math.random().


LICENSE (MIT)
-------------

Copyright (c)2014 David Bau.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

/**
 * All code is in an anonymous closure to keep the global namespace clean.
 */
(function (
    global, pool, math, width, chunks, digits, module, define, rngname) {

//
// The following constants are related to IEEE 754 limits.
//
var startdenom = math.pow(width, chunks),
    significance = math.pow(2, digits),
    overflow = significance * 2,
    mask = width - 1,

//
// seedrandom()
// This is the seedrandom function described above.
//
impl = math['seed' + rngname] = function(seed, options, callback) {
  var key = [];
  options = (options == true) ? { entropy: true } : (options || {});

  // Flatten the seed string or build one from local entropy if needed.
  var shortseed = mixkey(flatten(
    options.entropy ? [seed, tostring(pool)] :
    (seed == null) ? autoseed() : seed, 3), key);

  // Use the seed to initialize an ARC4 generator.
  var arc4 = new ARC4(key);

  // Mix the randomness into accumulated entropy.
  mixkey(tostring(arc4.S), pool);

  // Calling convention: what to return as a function of prng, seed, is_math.
  return (options.pass || callback ||
      // If called as a method of Math (Math.seedrandom()), mutate Math.random
      // because that is how seedrandom.js has worked since v1.0.  Otherwise,
      // it is a newer calling convention, so return the prng directly.
      function(prng, seed, is_math_call) {
        if (is_math_call) { math[rngname] = prng; return seed; }
        else return prng;
      })(

  // This function returns a random double in [0, 1) that contains
  // randomness in every bit of the mantissa of the IEEE 754 value.
  function() {
    var n = arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
        d = startdenom,                 //   and denominator d = 2 ^ 48.
        x = 0;                          //   and no 'extra last byte'.
    while (n < significance) {          // Fill up all significant digits by
      n = (n + x) * width;              //   shifting numerator and
      d *= width;                       //   denominator and generating a
      x = arc4.g(1);                    //   new least-significant-byte.
    }
    while (n >= overflow) {             // To avoid rounding up, before adding
      n /= 2;                           //   last byte, shift everything
      d /= 2;                           //   right using integer math until
      x >>>= 1;                         //   we have exactly the desired bits.
    }
    return (n + x) / d;                 // Form the number within [0, 1).
  }, shortseed, 'global' in options ? options.global : (this == math));
};

//
// ARC4
//
// An ARC4 implementation.  The constructor takes a key in the form of
// an array of at most (width) integers that should be 0 <= x < (width).
//
// The g(count) method returns a pseudorandom integer that concatenates
// the next (count) outputs from ARC4.  Its return value is a number x
// that is in the range 0 <= x < (width ^ count).
//
/** @constructor */
function ARC4(key) {
  var t, keylen = key.length,
      me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];

  // The empty key [] is treated as [0].
  if (!keylen) { key = [keylen++]; }

  // Set up S using the standard key scheduling algorithm.
  while (i < width) {
    s[i] = i++;
  }
  for (i = 0; i < width; i++) {
    s[i] = s[j = mask & (j + key[i % keylen] + (t = s[i]))];
    s[j] = t;
  }

  // The "g" method returns the next (count) outputs as one number.
  (me.g = function(count) {
    // Using instance members instead of closure state nearly doubles speed.
    var t, r = 0,
        i = me.i, j = me.j, s = me.S;
    while (count--) {
      t = s[i = mask & (i + 1)];
      r = r * width + s[mask & ((s[i] = s[j = mask & (j + t)]) + (s[j] = t))];
    }
    me.i = i; me.j = j;
    return r;
    // For robust unpredictability discard an initial batch of values.
    // See http://www.rsa.com/rsalabs/node.asp?id=2009
  })(width);
}

//
// flatten()
// Converts an object tree to nested arrays of strings.
//
function flatten(obj, depth) {
  var result = [], typ = (typeof obj), prop;
  if (depth && typ == 'object') {
    for (prop in obj) {
      try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
    }
  }
  return (result.length ? result : typ == 'string' ? obj : obj + '\0');
}

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
function mixkey(seed, key) {
  var stringseed = seed + '', smear, j = 0;
  while (j < stringseed.length) {
    key[mask & j] =
      mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
  }
  return tostring(key);
}

//
// autoseed()
// Returns an object for autoseeding, using window.crypto if available.
//
/** @param {Uint8Array|Navigator=} seed */
function autoseed(seed) {
  try {
    global.crypto.getRandomValues(seed = new Uint8Array(width));
    return tostring(seed);
  } catch (e) {
    return [+new Date, global, (seed = global.navigator) && seed.plugins,
            global.screen, tostring(pool)];
  }
}

//
// tostring()
// Converts an array of charcodes to a string
//
function tostring(a) {
  return String.fromCharCode.apply(0, a);
}

//
// When seedrandom.js is loaded, we immediately mix a few bits
// from the built-in RNG into the entropy pool.  Because we do
// not want to intefere with determinstic PRNG state later,
// seedrandom will not call math.random on its own again after
// initialization.
//
mixkey(math[rngname](), pool);

//
// Nodejs and AMD support: export the implemenation as a module using
// either convention.
//
if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
}

// End anonymous scope, and pass initial values.
})(
  this,   // global window object
  [],     // pool: entropy pool starts empty
  Math,   // math: package containing random, pow, and seedrandom
  256,    // width: each RC4 output is 0 <= x < 256
  6,      // chunks: at least six RC4 outputs for each double
  52,     // digits: there are 52 significant digits in a double
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define,  // present with an AMD loader
  'random'// rngname: name for Math.random and Math.seedrandom
);
});
KAdefine("javascript/react-package/kui/survey.jsx", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, eqeqeq, react/jsx-closing-bracket-location, react/jsx-indent-props, react/jsx-sort-prop-types, react/no-did-mount-set-state, react/no-did-update-set-state, react/sort-comp */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * A Qualaroo-style survey component for asking our users questions directly.
 *
 * Supports an arbitrary amounts of multiple-choice questions,
 * with per-answer callbacks and flexible branching.
 *
 * TODO(alex): Add the ability to accept text input
 * TODO(alex): Consider refactoring `questions` prop to use `children` instead
 */
var $ = require("jquery");
var classNames = require("classnames");
var React = require("react");
var ReactDOM = require("react-dom");

var $_ = require("../../shared-package/i18n.js").$_;

// Apparently seedrandom can not be explicitly required
require("../../../third_party/javascript-khansrc/seedrandom/seedrandom.js");

// Fischer-Yates shuffle
var shuffleArrayWithSeed = function (array, seed) {
    var shuffled = array.slice();
    var random = new Math.seedrandom(seed != null ? seed : Date.now() / 1000);
    for (var top = shuffled.length; top > 0; top--) {
        var newEnd = Math.floor(random() * top);
        var temp = shuffled[newEnd];
        shuffled[newEnd] = shuffled[top - 1];
        shuffled[top - 1] = temp;}

    return shuffled;};



var KUISurvey = React.createClass({ displayName: "KUISurvey", 
    propTypes: { 
        /* Lifecycle props */

        // An optional string to add to the classes of this component
        className: React.PropTypes.string, 

        // Controls whether or not the survey is shown; useful for
        // time-delayed triggering. Set to true to show on mount.
        triggered: React.PropTypes.bool, 

        // Whether this survey has been completed
        completed: React.PropTypes.bool, 
        onComplete: React.PropTypes.func.isRequired, // arg: completed

        /* Stateful props */

        // The number of the current question being displayed
        currentQuestion: React.PropTypes.number, 
        onNextQuestion: React.PropTypes.func.isRequired, // arg: nextQuestion

        // Whether the survey has been minimized
        minimized: React.PropTypes.bool, 
        onMinimize: React.PropTypes.func.isRequired, // arg: minimized

        /* Static props */

        // How long to show the thank you message for, in seconds
        messageDelay: React.PropTypes.number, 

        // A RNG seed for randomizing answer choice order
        randomSeed: React.PropTypes.number, 

        // The list of questions to ask. General rules of thumb:
        // 1) Put the most important question(s) first
        // 2) Start with a simple question - users are more likely to respond
        // 3) Don't ask too many questions
        // 4) Don't ask questions that are hard to answer
        questions: React.PropTypes.arrayOf(React.PropTypes.shape({ 
            prompt: React.PropTypes.node.isRequired, // i18n fragment
            answers: React.PropTypes.arrayOf(React.PropTypes.shape({ 
                text: React.PropTypes.node.isRequired, // i18n fragment

                // Callback triggered when this answer is selected.
                // Send data to BigBingo and/or Google Analytics here.
                onAnswer: React.PropTypes.func, // no args

                // The question to display next. Questions are zero-indexed.
                // If no next question is specified, the survey ends.
                nextQuestion: React.PropTypes.number })).
            isRequired })).
        isRequired }, 


    getDefaultProps: function () {
        return { 
            triggered: false, 
            completed: false, 
            currentQuestion: 0, 
            minimized: false, 
            messageDelay: 2 };}, 



    getInitialState: function () {
        return { 
            // The height of the component needs to be set dynamically because
            // it is position: fixed and has position: absolute children.
            height: 0, 

            // Only set to true when this specific survey (i.e. this component)
            // has been completed, to show a brief thank you message.
            showMessage: false };}, 



    componentDidMount: function () {
        if (!this.props.minimized) {
            this.setState({ height: this.calculateHeight() });}}, 



    componentDidUpdate: function (prevProps, prevState) {
        if (!prevProps.minimized && this.props.minimized) {
            this.setState({ height: 0 });} else 
        if (prevProps.triggered !== this.props.triggered || 
        prevProps.currentQuestion !== this.props.currentQuestion || 
        prevProps.minimized !== this.props.minimized || 
        prevState.showMessage !== this.state.showMessage) {
            this.setState({ height: this.calculateHeight() });}}, 



    calculateHeight: function () {
        return $(ReactDOM.findDOMNode(this.refs.question)).outerHeight(true);}, 


    render: function () {var _this = this;
        if (!this.props.triggered || 
        this.props.completed && !this.state.showMessage) {
            // Nothing to see here
            return null;}


        var body;
        if (this.state.showMessage) {
            // Show a thank you message
            body = React.createElement("div", { className: "kui-survey__question kui-survey__message", 
                ref: "question" }, 
            $_(null, "Thank you!"));} else 

        {
            // Show a question
            var question = this.props.questions[this.props.currentQuestion];
            body = React.createElement("div", { className: "kui-survey__question", ref: "question" }, 
            React.createElement("div", { className: "kui-survey__prompt" }, question.prompt), 
            React.createElement("div", null, 
            shuffleArrayWithSeed(question.answers.map(function (answer, i) {
                return React.createElement("div", { className: "kui-survey__answer", 
                    key: i, 
                    onClick: function () {return _this.onAnswer(answer);} }, 
                answer.text);}), 

            this.props.randomSeed)));}




        var className = classNames("kui-survey", this.props.className);

        return React.createElement("div", { className: className, style: { height: this.state.height } }, 
        React.createElement("div", { className: "kui-survey__handle", 
            onClick: function () {return _this.props.onMinimize(!_this.props.minimized);} }, 
        this.props.minimized ? 
        React.createElement("i", { className: "icon-plus", style: { fontSize: 14 } }) : 
        React.createElement("span", { style: { fontSize: 20 } }, "—")), 


        React.createElement("div", { className: "kui-survey__body" }, body));}, 



    onAnswer: function (answer) {var _this2 = this;
        answer.onAnswer && answer.onAnswer();
        if (answer.nextQuestion != null) {
            this.props.onNextQuestion(answer.nextQuestion);} else 
        {
            this.setState({ showMessage: true }, function () {
                _this2.props.onComplete(true);
                setTimeout(function () {return _this2.setState({ showMessage: false });}, 
                1000 * _this2.props.messageDelay);});}} });





module.exports = KUISurvey;
});
KAdefine("javascript/shared-package/session-survey.jsx", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable no-trailing-spaces, react/jsx-closing-bracket-location, react/jsx-indent-props, react/jsx-sort-props, react/prop-types, react/sort-comp */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Handles the triggering logic for session surveys.
 *
 * The intent of session surveys is to gauge user satisfaction during each
 * session along two axes: Helpfulness and findability.
 *
 * Note that the session survey is only guaranteed to trigger for one session
 * per pageload. In the specific case where a user goes goes back to a KA tab
 * that has previously shown a session survey (which was either filled out or
 * closed because the session time out) a new session survey will not be shown
 * in that tab until the next KA pageload (across all tabs).
 */
var React = require("react");
var ReactDOM = require("react-dom");

var $_ = require("./i18n.js").$_;
var BigBingo = require("./bigbingo.js");
var Cookies = require("./cookies.js");
var LocalStore = require("./local-store.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;
var Survey = require("../react-package/kui/survey.jsx");

// Don't error if hide_analytics is true
var ga = window.ga || function () {};

var QUESTIONS = [
{ 
    prompt: $_(null, "Was Khan Academy helpful to you today?"), 
    answers: [
    { 
        text: $_(null, "Yes"), 
        onAnswer: function () {
            BigBingo.markConversion("session_helpful_yes");
            ga("send", "event", "Session", "Helpful", "Yes");}, 

        nextQuestion: 1 }, 

    { 
        text: $_(null, "No"), 
        onAnswer: function () {
            BigBingo.markConversion("session_helpful_no");
            ga("send", "event", "Session", "Helpful", "No");}, 

        nextQuestion: 1 }] }, 



{ 
    prompt: $_(null, "Did you find what you came here for today?"), 
    answers: [
    { 
        text: $_(null, "Yes, easily"), 
        onAnswer: function () {
            BigBingo.markConversion("session_findable_yes_easily");
            ga("send", "event", "Session", "Findable", "Yes, easily");} }, 


    { 
        text: $_(null, "Yes, eventually"), 
        onAnswer: function () {
            BigBingo.markConversion(
            "session_findable_yes_eventually");
            ga("send", "event", "Session", "Findable", 
            "Yes, eventually");} }, 


    { 
        text: $_(null, "No"), 
        onAnswer: function () {
            BigBingo.markConversion("session_findable_no");
            ga("send", "event", "Session", "Findable", "No");} }, 


    { 
        text: $_(null, "I wasn't looking for anything in particular"), 
        onAnswer: function () {
            BigBingo.markConversion(
            "session_findable_not_applicable");
            ga("send", "event", "Session", "Findable", 
            "Not Applicable");} }] }];





var SESSION_COOKIE_NAME = "ka_session";
var SESSION_SURVEY_STORE_KEY = "session_survey";
var SESSION_TIMEOUT_LENGTH_IN_SECONDS = 30 * 60; // 30 minutes
var SESSION_VALIDATION_LOOP_LENGTH_IN_SECONDS = 5 * 60; // 5 minutes


var SessionSurvey = React.createClass({ displayName: "SessionSurvey", 
    getInitialState: function () {
        return LocalStore.get(SESSION_SURVEY_STORE_KEY) || {};}, 


    setStateAndStore: function (newState, callback) {
        // Local storage is the source of truth, so most of the time we want
        // to write to both it and component state at the same time.
        var storedState = LocalStore.get(SESSION_SURVEY_STORE_KEY) || {};
        var completeState = babelHelpers._extends({}, storedState, newState);
        LocalStore.set(SESSION_SURVEY_STORE_KEY, completeState);
        this.setState(completeState, callback);}, 


    render: function () {var _this = this;
        return React.createElement(Survey, { 
            className: "session-survey", 
            triggered: this.state.triggered, 
            completed: this.state.completed, 
            onComplete: function (completed) {
                _this.setStateAndStore({ completed: completed });}, 

            currentQuestion: this.state.currentQuestion, 
            onNextQuestion: function (nextQuestion) {
                _this.setStateAndStore({ currentQuestion: nextQuestion });}, 

            minimized: this.state.minimized, 
            onMinimize: function (minimized) {
                _this.setStateAndStore({ minimized: minimized });}, 

            randomSeed: this.state.randomSeed, 
            questions: this.props.questions });}, 


    /* Component lifecyle */

    componentWillMount: function () {
        this.checkForNewSession();}, 


    componentDidMount: function () {
        if (!this.state.triggered) {
            this.startSessionTriggerTimer();} else 
        {
            this.startSessionValidationLoop();}


        window.addEventListener("storage", this.onStorage);
        window.addEventListener("focus", this.onFocus);}, 


    componentDidUpdate: function (prevProps, prevState) {
        if (this.state.triggered && !prevState.triggered) {
            this.startSessionValidationLoop();}}, 



    componentWillUnmount: function () {
        window.removeEventListener("storage", this.onStorage);
        window.removeEventListener("focus", this.onFocus);}, 


    /* Implementation logic */

    checkForNewSession: function () {
        var sessionCookie = Cookies.readCookie(SESSION_COOKIE_NAME);
        var sessionId = sessionCookie && sessionCookie.split(":")[0];

        if (!sessionId) {
            // Something weird is going on with the session cookie, so bail
            return;}


        if (sessionId !== this.state.sessionId) {
            // The sessionId from the cookie (which is set by the server)
            // doesn't match the latest sessionID the client is aware of.
            // This means that this is the first page load of a new session,
            // and we need to pick a time in this session when we want to
            // trigger showing the survey.
            // 
            // We want this time to be as late as possible in the session,
            // so that users have time to actually use the site before we ask
            // them what their experience with it was like today. Therefore we
            // want to model our survey time distribution after the overall
            // histogram of session lengths (as reported by Google Analytics),
            // which is heavily skewed to the right.
            //
            // The following scheme is pretty simple. We set our lower bound
            // to 10 seconds (to avoid users who immediately bounce) and our
            // upper bound to 30 minutes (so that the survey is guaranteed to
            // trigger before the session times out). We generate x uniformly
            // at random in [0, 1]. Then, sqrt(x) has a distribution that
            // prefers values closer to 1, i.e. times closer to 30 minutes.
            var currentTime = Date.now() / 1000;
            var surveyTime = currentTime + 
            10 + 
            (30 * 60 - 10) * Math.sqrt(Math.random());

            this.setStateAndStore({ 
                triggered: false, 
                completed: false, 
                currentQuestion: 0, 
                minimized: false, 

                // Store RNG seed here so that answer choices are
                // permuted in the same way across all tabs.
                randomSeed: currentTime, 

                sessionId: sessionId, 
                surveyTime: surveyTime });}}, 




    startSessionTriggerTimer: function () {var _this2 = this;
        // Start the countdown associated with showing this survey. Since we
        // want to avoid double firing the relevant analytics events, we
        // slightly perturb the delay so that only one tab will actually
        // trigger them.
        var currentTime = Date.now() / 1000;
        var delay = this.state.surveyTime - currentTime + Math.random();
        setTimeout(function () {
            if (!_this2.isMounted()) {
                return;}


            // Local storage is set synchronously, so check it instead of
            // component state (which is set asynchronously) here.
            var latestState = LocalStore.get(SESSION_SURVEY_STORE_KEY) || {};
            if (!latestState.triggered) {
                _this2.setStateAndStore({ triggered: true });
                BigBingo.markConversion("session_survey_shown");
                ga("send", "event", "Session", "Survey", "Shown");}}, 

        1000 * Math.max(delay, 0));}, 


    startSessionValidationLoop: function () {var _this3 = this;
        // Every so often, while a survey is shown, check that the current
        // session hasn't timed out. If it has, stop showing the survey.
        var closeSurvey = function () {return _this3.setStateAndStore({ completed: true });};
        var loop = function () {
            if (_this3.state.completed) {
                // The survey has been completed, so we can stop our checks
                return;}


            var currentTime = Date.now() / 1000;
            var sessionCookie = Cookies.readCookie(SESSION_COOKIE_NAME);
            var lastActivityStr = sessionCookie && sessionCookie.split(":")[2];
            var lastActivity = lastActivityStr && Number(lastActivityStr);

            if (!lastActivity) {
                // Something weird is going on with the session cookie, so bail
                closeSurvey();} else 
            if (currentTime - lastActivity > 
            SESSION_TIMEOUT_LENGTH_IN_SECONDS) {
                // The session has timed out, so close the survey
                closeSurvey();} else 
            {
                // The session is still valid, so check back later
                setTimeout(loop, 
                SESSION_VALIDATION_LOOP_LENGTH_IN_SECONDS * 1000);}};


        loop();}, 


    onStorage: function (event) {
        if (event.key === LocalStore.cacheKey(SESSION_SURVEY_STORE_KEY)) {
            // Keep this window's survey in sync with other windows' surveys
            this.setState(LocalStore.get(SESSION_SURVEY_STORE_KEY) || {});}}, 



    onFocus: function () {
        if (this.state.triggered && !this.state.completed) {
            // If this window receives focus while the survey is being shown,
            // make sure this counts as activity by directly pinging the API.
            // This is so that a user coming back to a page with a triggered
            // survey will be guaranteed to have time to answer it.
            return khanFetch("/api/internal/ping");}} });




var initializeSessionSurvey = function () {
    // In the rare case localStorage is not enabled, we won't show the survey
    if (!LocalStore.isEnabled()) {
        return;}


    var mountPoint = document.createElement("div");
    document.body.appendChild(mountPoint);
    return ReactDOM.render(
    React.createElement(SessionSurvey, { questions: QUESTIONS }), 
    mountPoint);};


module.exports = initializeSessionSurvey;
});
KAdefine("javascript/shared-package/generic-dialog.handlebars", function(require, module, exports) {
require("../../third_party/javascript-khansrc/handlebars/handlebars.runtime.js");
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, stack2, foundHelper, tmp1, self=this, functionType="function", helperMissing=helpers.helperMissing, undef=void 0, escapeExpression=this.escapeExpression;

function program1(depth0,data) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n    <div class=\"modal-footer\">\n        ";
  foundHelper = helpers.buttons;
  stack1 = foundHelper || depth0.buttons;
  stack2 = helpers.each;
  tmp1 = self.program(2, program2, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n    </div>\n    ";
  return buffer;}
function program2(depth0,data) {
  
  var buffer = "", stack1, stack2;
  buffer += "\n            ";
  foundHelper = helpers.buttonColor;
  stack1 = foundHelper || depth0.buttonColor;
  stack2 = helpers['if'];
  tmp1 = self.program(3, program3, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.program(5, program5, data);
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        ";
  return buffer;}
function program3(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                <a class=\"generic-button simple-button ";
  foundHelper = helpers.buttonColor;
  stack1 = foundHelper || depth0.buttonColor;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "buttonColor", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\" href=\"javascript:void(0)\" data-id=\"";
  foundHelper = helpers.title;
  stack1 = foundHelper || depth0.title;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "title", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.title;
  stack1 = foundHelper || depth0.title;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "title", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</a>\n            ";
  return buffer;}

function program5(depth0,data) {
  
  var buffer = "", stack1;
  buffer += "\n                <a class=\"generic-button simple-button\" href=\"javascript:void(0)\" data-id=\"";
  foundHelper = helpers.title;
  stack1 = foundHelper || depth0.title;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "title", { hash: {} }); }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.title;
  stack1 = foundHelper || depth0.title;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "title", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</a>\n            ";
  return buffer;}

  buffer += "<div class=\"generic-dialog modal hide\">\n    <div class=\"modal-header\">\n        <span class=\"close\" data-dismiss=\"modal\">&#215;</span>\n        <h2>";
  foundHelper = helpers.title;
  stack1 = foundHelper || depth0.title;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "title", { hash: {} }); }
  buffer += escapeExpression(stack1) + "</h2>\n    </div>\n    <div class=\"modal-body\">\n        <p>";
  foundHelper = helpers.message;
  stack1 = foundHelper || depth0.message;
  if(typeof stack1 === functionType) { stack1 = stack1.call(depth0, { hash: {} }); }
  else if(stack1=== undef) { stack1 = helperMissing.call(depth0, "message", { hash: {} }); }
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "</p>\n    </div>\n    ";
  foundHelper = helpers.buttons;
  stack1 = foundHelper || depth0.buttons;
  stack2 = helpers['if'];
  tmp1 = self.program(1, program1, data);
  tmp1.hash = {};
  tmp1.fn = tmp1;
  tmp1.inverse = self.noop;
  stack1 = stack2.call(depth0, stack1, tmp1);
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n</div>\n";
  return buffer;});
module.exports = t;
});
KAdefine("javascript/shared-package/pageutil.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable brace-style, comma-dangle, comma-spacing, eqeqeq, max-len, no-alert, one-var, prefer-template, space-after-keywords, space-infix-ops, space-unary-ops */
/* To fix, remove an entry above, run "make linc", and fix errors. */

require(
"../../third_party/javascript-khansrc/bootstrap-khansrc/js/bootstrap-modal.js"); // @Nolint
var $ = require("jquery");
var moment = require("moment");

var i18n = require("./i18n.js");
var BigBingo = require("./bigbingo.js"); // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
var NotificationsLoader = require("./notifications-loader.js");

// TODO(benkomalo): why does this block of code exist? why doesn't it re-use
// the normal notifications code? It seems to be a copied and pasted block.
var DemoNotifications = { // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
    // for demo-notification-bar (blue and orange, which informs to logout after demo
    show: function () {
        // Tell the notifications loader to render an urgent "demo account"
        // notification.
        NotificationsLoader.loadUrgent({ 
            class_: ["DemoNotification"] });


        // TODO(kamens): this method of detecting a user leaving the demo area
        // is very brittle. Needs a rethinking if we increasingly rely on the
        // demo experience.
        $(".show-demo-dialog").click(function (e) {
            e.preventDefault();
            var target = e.target.href || "/";
            target = "/logout?continue=" + encodeURIComponent(target);

            // TODO(kitt): Delete or adjust to use the proper styling.
            popupGenericMessageBox({ 
                title: "Leaving Demo", 
                message: i18n._("The Demo allows you to view coach and student reports for a demo account. Navigating out of the demo area will log you out of the demo account."), 
                buttons: [
                { title: "Cancel", action: hideGenericMessageBox }, 
                { title: "Leave demo", action: function () {hideGenericMessageBox;window.location = target;}, buttonColor: "green" }] });});} };






/**
 * Helper function which converts a moment.js object to an ISO 8601 string
 */
var toISO8601 = function (date) {// @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
    return moment(date).utc().format().replace("+00:00", "Z");};


var CSSMenus = { 

    active_menu: null, 

    init: function () {
        // Make the CSS-only menus click-activated
        $(".noscript").removeClass("noscript");
        $(document).delegate(".css-menu > ul > li", "click", function () {
            if (CSSMenus.active_menu) {
                CSSMenus.active_menu.removeClass("css-menu-js-hover");}


            if (CSSMenus.active_menu && this === CSSMenus.active_menu[0]) {
                CSSMenus.active_menu = null;} else 
            {
                CSSMenus.active_menu = $(this).addClass("css-menu-js-hover");}});



        $(document).bind("click focusin", function (e) {
            if (CSSMenus.active_menu && 
            $(e.target).closest(".css-menu").length === 0) {
                CSSMenus.active_menu.removeClass("css-menu-js-hover");
                CSSMenus.active_menu = null;}});



        // Make the CSS-only menus keyboard-accessible
        $(document).delegate(".css-menu a", { 
            focus: function (e) {
                $(e.target).
                addClass("css-menu-js-hover").
                closest(".css-menu > ul > li").
                addClass("css-menu-js-hover");}, 

            blur: function (e) {
                $(e.target).
                removeClass("css-menu-js-hover").
                closest(".css-menu > ul > li").
                removeClass("css-menu-js-hover");} });} };





var Throbber = { 
    jElement: null, 

    show: function (jTarget, fOnLeft) {
        if (!Throbber.jElement) 
        {
            Throbber.jElement = $("<img style='display:none;' src='/images/throbber.gif' class='throbber'/>");
            $(document.body).append(Throbber.jElement);}


        if (!jTarget.length) {
            return;}


        var offset = jTarget.offset();

        var top = offset.top + jTarget.height() / 2 - 8;
        var left = fOnLeft ? offset.left - 16 - 4 : offset.left + jTarget.width() + 4;

        Throbber.jElement.css("top", top).css("left", left).css("z-index", 2000).css("display", "");}, 


    hide: function () {
        if (Throbber.jElement) {
            Throbber.jElement.css("display", "none");}} };




// This function detaches the passed in jQuery element and returns a function that re-attaches it
var temporaryDetachElement = function (element, fn, context) {// @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
    var el, reattach;
    el = element.next();
    if (el.length > 0) {
        // This element belongs before some other element
        reattach = function () {
            element.insertBefore(el);};} else 

    {
        // This element belongs at the end of the parent's child list
        el = element.parent();
        reattach = function () {
            element.appendTo(el);};}


    element.detach();
    var val = fn.call(context || this, element);
    reattach();
    return val;};


// TODO(benkomalo): consider /moving/killing this "generic message box".
// It's really only used in topic admin pages, and for the "demo account".
var messageBox = null;

var popupGenericMessageBox = function (options) {
    if (messageBox) {
        $(messageBox).modal("hide").remove();}


    options = babelHelpers._extends({ 
        buttons: [
        { title: "OK", action: hideGenericMessageBox }] }, 

    options // @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)
    );

    var template = require("./generic-dialog.handlebars");
    messageBox = $(template(options)).appendTo(document.body).modal({ 
        keyboard: true, 
        backdrop: true, 
        show: true }).
    get(0);

    if (options.width) {
        $(messageBox).css({ 
            "width": options.width + "px", 
            "margin-left": -0.5 * options.width + "px" });}



    options.buttons.forEach(function (button) {
        $(".generic-button[data-id=\"" + button.title + "\"]", $(messageBox)).
        click(button.action);});};

// @Nolint(remove this nolint after moving to eslint, definitely after 1 Nov 2015)

var hideGenericMessageBox = function () {
    if (messageBox) {
        $(messageBox).modal("hide");}

    messageBox = null;};


/**
 * Determine whether the page has been reached by the back button.
 *
 * This can be useful for figuring out when there may be stale data which may
 * need to be reloaded from the server when the page initializes. It needs
 * {{ browser_cache.add_browser_cache_detection() }} to be added to the page
 * template for it to work
 */
var isLoadedFromBrowserCache = function () {
    if (isLoadedFromBrowserCache.memoized == null) {
        isLoadedFromBrowserCache.memoized = $("#page_loaded_from_browser_cache").val() === "1";
        $("#page_loaded_from_browser_cache").val("1");}

    return isLoadedFromBrowserCache.memoized;};


/**
 * A function that should add a bookmark in most browsers.
 * On Safari/Chrome it pops an alert() instructing the user to hit ctrl+d
 * for themselves.
 * Arguments:
 *      macBookmarkMessage - Shown to mac-users running a browser that does not
 *          expose bookmarking functionality. Should include instructions for
 *          pressing cmd+D
 *      nonMacBookmarkMessage - Like macBookmarkMessage, but for non-macs.
 * Pulled from
 * http://stackoverflow.com/questions/10033215/add-to-favorites-button
 */
var bookmarkMe = function (macBookmarkMessage, nonMacBookmarkMessage) {
    if (window.sidebar && window.sidebar.addPanel) {// Mozilla Firefox Bookmark
        window.sidebar.addPanel(document.title, window.location.href, "");} else 
    if (window.external && window.external.AddFavorite) {// IE Favorite
        window.external.AddFavorite(location.href, document.title);} else 
    if (window.opera && window.print) {// Opera Hotlist
        this.title = document.title;
        return true;} else 
    {// webkit - safari/chrome
        var macMsg = macBookmarkMessage || i18n._("Press Command + D to bookmark this page.");
        var nonMacMsg = nonMacBookmarkMessage || i18n._("Press CTRL + D to bookmark this page.");

        if (navigator.userAgent.toLowerCase().indexOf("mac") !== -1) {
            alert(macMsg);} else 
        {
            alert(nonMacMsg);}}};




// TODO(csilvers): split this up to one file per export!
module.exports = { 
    BigBingo: BigBingo, 
    CSSMenus: CSSMenus, 
    DemoNotifications: DemoNotifications, 
    Throbber: Throbber, 
    bookmarkMe: bookmarkMe, 
    hideGenericMessageBox: hideGenericMessageBox, 
    isLoadedFromBrowserCache: isLoadedFromBrowserCache, 
    toISO8601: toISO8601, 
    popupGenericMessageBox: popupGenericMessageBox, 
    temporaryDetachElement: temporaryDetachElement };
});
KAdefine("javascript/shared-package/parse-query-string.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable eqeqeq, one-var */
/* To fix, remove an entry above, run "make linc", and fix errors. */

// Query String Parser
// Original from:
// http://stackoverflow.com/questions/901115/get-querystring-values-in-javascript/2880929#2880929
var parseQueryString = function (query) {
    query = query != null ? query : window.location.search.substring(1);
    var urlParams = {}, 
    e, 
    a = /\+/g, // Regex for replacing addition symbol with a space
    r = /([^&=]+)=?([^&]*)/g, 
    d = function (s) {return decodeURIComponent(s.replace(a, " "));};

    while (e = r.exec(query)) {
        urlParams[d(e[1])] = d(e[2]);}


    return urlParams;};


module.exports = parseQueryString;
});
KAdefine("javascript/shared-package/timezone.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

// TODO(benkomalo): unit test.
var Timezone = { 
    /**
     * Appends a `tz_offset` query parameter to a given URL representing the
     * timezone offset (in minutes) computed on a given date (defaulting to
     * the present day).
     */
    append_tz_offset_query_param: function (href, date) {
        if (href.indexOf("?") > -1) {
            href += "&";} else 
        {
            href += "?";}

        return href + "tz_offset=" + Timezone.get_tz_offset(date);}, 


    /**
     * Computes the timezone offset (in minutes) on a given date, or by
     * default, today. This offset is returned as negative time.
     */
    get_tz_offset: function (date) {
        date = date || new Date();
        return -1 * date.getTimezoneOffset();} };



module.exports = Timezone;
});
KAdefine("javascript/shared-package/update-document-title.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable one-var, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * Update the document (i.e. webpage) title to reflect the user's brand new
 * notification count and the name of the page that she is on.
 *
 * Example format: "(3) Multiplying 1-digit numbers..."
 *
 * This function forms the document title by looking at KA.currentPageName and
 * the countBrandNewNotifications property in KA.getUserProfile(). You can
 * optionally pass an argument object with "pageName" and "noteCount" as
 * properties. The function will update the KA vars and document title
 * accordingly.
 */

var i18n = require("./i18n.js");
var KA = require("./ka.js");

var updateDocumentTitle = function (args) {
    var profile = KA.getUserProfile();

    if (args && typeof args.pageName !== "undefined") {
        KA.currentPageName = args.pageName + " | " + i18n._("Khan Academy");}

    if (args && profile && typeof args.noteCount !== "undefined") {
        profile.set("countBrandNewNotifications", args.noteCount);}


    var noteCount = profile ? profile.get("countBrandNewNotifications") : 0, 
    pageName = KA.currentPageName;

    document.title = noteCount > 0 ? 
    "(" + noteCount + ") " + pageName : pageName;};


module.exports = updateDocumentTitle;
});
KAdefine("javascript/shared-package/validate-email.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable max-len */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

var validateEmail = function (sEmail) {
    return sEmail.match(re);};


module.exports = validateEmail;
});
KAdefine("javascript/shared-package/badges.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, max-len, no-unused-vars, prefer-template */
/* To fix, remove an entry above, run "make linc", and fix errors. */

require("../../third_party/javascript-khansrc/qTip2/jquery.qtip.js");
var $ = require("jquery");
var Backbone = require("backbone");

var i18n = require("./i18n.js");
var Analytics = require("./analytics.js");
var FacebookUtil = require("./facebookutil.js");
var KA = require("./ka.js");
var KAConsole = require("./console.js");var _require = 
require("./khan-fetch.js");var khanFetch = _require.khanFetch;
var Social = require("./social.js");

/**
 * Code to handle badge-related UI components.
 */
var Badges = { 
    showMoreContext: function (el) {
        var $link = $(el).parents(".badge-context-hidden-link");
        var $badge = $link.parents(".achievement-badge");
        var $context = $(".badge-context-hidden", $badge);

        if ($link.length && $badge.length && $context.length) {
            $(".ellipsis", $link).remove();
            $link.html($link.text());
            $context.css("display", "");
            $badge.find(".achievement-desc").addClass("expanded");
            // TODO(emily): Turn these into classes instead of just setting
            // inline styles.
            $badge.css("min-height", $badge.css("height")).css("height", "auto");}}, 



    /**
     * Add share links to the container specified by $el.
     *
     * This is used to render share links under the big badge displays shown at
     * /badges/<badge_name>.
     */
    renderShareLinks: function ($el, badge) {
        var context = Badges.ShareLinksView.addShareLinksContext(badge);

        var view = new Badges.ShareLinksView({ 
            el: $el, 
            model: new Backbone.Model(context) });


        view.render();} };




/**
 * @enum {number}
 */
Badges.ContextType = { 
    NONE: 0, 
    EXERCISE: 1, 
    PLAYLIST: 2 };


/**
 * @enum {number}
 */
Badges.Category = { 
    BRONZE: 0, // Meteorite, "Common"
    SILVER: 1, // Moon, "Uncommon"
    GOLD: 2, // Earth, "Rare"
    PLATINUM: 3, // Sun, "Epic"
    DIAMOND: 4, // Black Hole, "Legendary"
    MASTER: 5 // Topic/Academic Achievement
};

/**
 * A single badge that a user can earn.
 * Parallel to the JSON serialized formats of badges.Badge
 */
Badges.Badge = Backbone.Model.extend({ 
    defaults: { 
        "badgeCategory": Badges.Category.BRONZE, 
        "name": "__empty__", 
        "description": "", 
        "icons": {}, 
        "isOwned": false, 
        "points": 0, 
        "safeExtendedDescription": "" }, 


    isEmpty: function () {
        // Specially reserved name for empty badge slots.
        // Used in display case - must be synced with what the server
        // understands in util_badges.py
        return this.get("name") === "__empty__";}, 


    toJSON: function () {
        var json = Badges.Badge.__super__.toJSON.call(this);
        json["isEmpty"] = this.isEmpty();
        return json;} });



/**
 * A re-usable instance of an empty badge.
 */
Badges.Badge.EMPTY_BADGE = new Badges.Badge({});

/**
 * Badge information about a badge, or a set of badges that a user has earned
 * grouped by their badge type.
 * Parallel to the JSON serialized formats of badges.GroupedUserBadge
 */
Badges.UserBadge = Backbone.Model.extend({ 
    defaults: { 
        "badge": null, 
        "count": 1, 
        "lastEarnedDate": "2011-11-22T00:00:00Z", 
        "targetContextNames": [], 
        "isOwned": true }, 


    initialize: function (attributes, options) {
        if (!this.get("badge")) {
            throw new Error("A UserBadge object needs a reference badge object");}


        // Wrap the underlying badge info in a Model object and forward
        // change events.
        var badgeModel = new Badges.Badge(this.get("badge"));
        this.set({ "badge": badgeModel }, { "silent": true });
        badgeModel.bind(
        "change", 
        function (ev) {this.trigger("change:badge");}, 
        this);} });



/**
 * Add extra context to userBadge for use when rendering
 * user-badge.handlebars
 *
 * @param {Object} userBadge, a JSON representation of a GroupedUserBadge
 * @return {Object} The same userBadge object passed in after having been
 * modified
 */
Badges.addUserBadgeContext = function (userBadge) {
    var translatedTargetContextNames = userBadge[
    "translatedTargetContextNames"];
    var numHidden = translatedTargetContextNames.length - 1;
    userBadge["visibleContextName"] = translatedTargetContextNames[0] || "";
    userBadge["listContextNamesHidden"] = $.map(
    translatedTargetContextNames.slice(1), 
    function (name, nameIndex) {
        return { 
            name: name, 
            isLast: nameIndex === numHidden - 1 };});


    userBadge["hasMultiple"] = userBadge["count"] > 1;
    return userBadge;};


/**
 * A list of badges that can be listened to.
 * This list can be edited by adding or removing from the collection,
 * and saved up to a server.
 */
Badges.BadgeList = Backbone.Collection.extend({ 
    model: Badges.Badge, 

    saveUrl: null, 

    /**
     * Whether or not this badge list has been modified since the last
     * save to the server.
     */
    dirty_: false, 

    setSaveUrl: function (url) {
        this.saveUrl = url;}, 


    toJSON: function () {
        return this.map(function (badge) {
            return badge.get("name");});}, 



    add: function (models, options) {
        Badges.BadgeList.__super__.add.apply(this, arguments);
        this.dirty_ = true;}, 


    remove: function (models, options) {
        Badges.BadgeList.__super__.remove.apply(this, arguments);
        this.dirty_ = true;}, 


    /**
     * Saves the collection to the server via Backbone.sync.
     * This does *not* save any individual edits to Badges within this list;
     * it simply posts the information about what belongs in the set.
     * @param {Object} options Options similar to what Backbone.sync accepts.
     */
    save: function (options) {
        if (!this.dirty_) {
            return;}

        options = options || {};
        options["url"] = this.saveUrl;
        options["contentType"] = "application/json";
        options["data"] = JSON.stringify(this.map(function (badge) {
            return badge.get("name");}));

        Backbone.sync.call(this, "update", this, options);
        this.dirty_ = false;}, 


    // TODO: figure out how to do this in a more systematic way!
    // Override base Backbone.parse since badge modifications can result in
    // api_action_results to be sent back.
    parse: function (resp, xhr) {
        if ("apiActionResults" in resp && "payload" in resp) {
            resp = resp["payload"];}

        Backbone.Model.prototype.parse.call(this, resp, xhr);} });



/**
 * A list of user badges that can be listened to.
 */
Badges.UserBadgeList = Backbone.Collection.extend({ 
    model: Badges.UserBadge });



// TODO(benkomalo): move to another file and delay load. We don't need to
// have event handling code on initial load.
/**
 * This view represents the actual share links that appear on a
 * Badge.Notifications and inside activity views on the profile page.
 */
Badges.ShareLinksView = Backbone.View.extend({ 
    template: require("./share-links.handlebars"), 

    events: { 
        "click .emailShare": "shareEmail", 
        "click .twitterShare": "shareTwitter", 
        "click .facebookShare": "shareFacebook" }, 


    render: function () {
        this.$el.html(this.template(this.model.attributes));}, 


    /**
     * Use Google analytics and Mixpanel to track badge shares
     * @param {string} action How the badge was shared (ex: "Share Twitter")
     */
    trackShare: function (action) {
        var description = this.model.get("description");
        var badgeCategory = this.model.get("badgeCategory");
        if (window.ga) {
            // syntax: ga(..., category, action, label, value)
            ga("send", "event", "Badges", action, description, badgeCategory);}

        // Using Mixpanel to track share
        var analyticsParams = {};
        analyticsParams["Description"] = description;
        analyticsParams["Badge Category"] = badgeCategory;
        analyticsParams["Name"] = this.model.get("name");
        analyticsParams["Points"] = this.model.get("points");

        Analytics.trackSingleEvent("Badges " + action, analyticsParams);}, 


    shareEmail: function (e) {
        this.trackShare("Share Email");}, 


    shareTwitter: function (e) {
        this.trackShare("Share Twitter");}, 


    shareFacebook: function (e) {
        // if the button has already been pressed, ignore
        if (this.alreadySharedOnFacebook) {
            KAConsole.log("Ignored duplicate share attempt.");
            return;}


        // users are not allowed to share without a Khan Academy account
        if (!KA.getUserProfile()) {
            // prompt phantom user to log in or sign up
            this.showQTip(i18n._("<a href='/login?continue=/profile' class='simple-button qtip-button green'>Log in</a> to claim your badge on Facebook."));
            return;}


        // find out which badge to share
        var badge = this.model;
        var badgeSlug = badge.get("slug");

        // if the user is logged in via Facebook
        var isUsingFbLogin = KA.getUserProfile() && FacebookUtil.isUsingFbLogin();

        // if user is logged in through Facebook and the cookie indicates
        // they have granted publish_stream permission, try to publish a
        // custom OpenGraph "earn badge" action to user's Facebook Timeline
        if (isUsingFbLogin && FacebookUtil.hasPublishStreamPermission()) {
            this.openGraphShare(badgeSlug);} else 

        {

            // attempt to log in to prompt user for publish_stream permission.
            // use .bind to ensure that 'this' is set to the right context
            // when the callback is executed.
            var self = this;
            FacebookUtil.runOnFbReady(function () {
                FB.login(function (response) {
                    // TODO(stephanie): refactor out this redundant error checking
                    if (!response || response.error || !response.authResponse) {
                        var code = response && response.error ? 
                        response.error.code : null;
                        self.handleFacebookErrors(code);} else 

                    if (response) {

                        // check the permissions to see if the user granted it
                        FB.api("/me/permissions", "get", function (response) {

                            if (!response || response.error) {
                                var code = response && response.error ? 
                                response.error.code : null;
                                self.handleFacebookErrors(code);} else 

                            {

                                var permissionGranted = response.data && 
                                response.data[0] && 
                                response.data[0].publish_stream === 1;
                                if (permissionGranted) {

                                    FacebookUtil.setPublishStreamPermission(true);
                                    // need to bind 'this' to the right context
                                    self.openGraphShare(badgeSlug);

                                    // permission was not granted
                                } else {

                                    FacebookUtil.setPublishStreamPermission(false);

                                    // TODO: bundle this into handleErrors?
                                    self.showQTip(i18n._("Sorry, you must grant access in order to share this on Facebook. Try again."));
                                    KAConsole.log("FB OpenGraph badge share failed - permission denied.");}}});}}, 






                { "scope": "email,publish_stream" });});}}, 




    handleFacebookErrors: function (code) {
        // permission denied error
        if (code === 200) {
            FacebookUtil.setPublishStreamPermission(false);
            this.showQTip(i18n._("Sorry, you must grant access in order to share this on Facebook. Try again."));

            // duplicate OG post error
        } else if (code === 3501) {
            this.setShared(i18n._("This badge has already been posted to your timeline."));

            // TODO: find out other error codes
        } else {
            this.showQTip(i18n._("Sorry, we weren't able to share this. Please try again later."));}}, 



    handleErrors: function (jqXHR) {
        var msg = jqXHR.responseText;
        var status = jqXHR.status;
        KAConsole.log(msg);

        // Khan Academy permission error
        if (status === 401) {
            this.showQTip(i18n._("Sorry, our records don't show that you've earned this badge."));
            return;

            // Open Graph error
        } else if (status === 400) {

            var re = /(#)(\d+)/;
            var matches = re.exec(msg);

            if (matches) {
                var code = matches[2];
                this.handleFacebookErrors(parseInt(code));
                return;}}


        this.showQTip(i18n._("Sorry, we weren't able to share this. Please try again."));}, 


    /**
     * Send request to Khan Academy API to publish an Open Graph "earn" action.
     */
    openGraphShare: function (badgeSlug) {var _this = this;
        this.showQTip("<img src='/images/spinner-arrows-bg-1c1c1c.gif' style='margin-right: 5px; position: relative; top: 1px'> " + i18n._("Sharing on Facebook..."), true);
        return khanFetch("/api/internal/user/badges/" + 
        badgeSlug + "/opengraph-earn", 
        { method: "POST" }).then(
        function () {return _this.finishShare();}, 
        function (error) {return _this.handleErrors(error);});}, 



    setShared: function (message) {
        this.alreadySharedOnFacebook = true;
        this.$(".facebookShare").contents().last().replaceWith("Shared");
        this.showQTip(message);}, 


    finishShare: function () {
        this.setShared(i18n._("This badge will now appear in your timeline!"));
        this.trackShare("Share Facebook Open Graph");
        KAConsole.log("OG post succeeded!");}, 


    /** Shows a qtip notification indicating that sharing has succeeded. */
    showQTip: function (message, disableHide) {var _this2 = this;
        var options = { 
            content: message, 
            position: { 
                my: "top right", 
                at: "bottom left" }, 

            show: { 
                ready: true }, 

            style: "qtip-shadow qtip-rounded qtip-youtube", 
            hide: { 
                delay: 5000 }, 

            events: { 
                // remove the delay the first time the tooltip is hidden
                hidden: this.removeHideDelay.bind(this) } };



        if (disableHide) {
            options.hide = false;
            delete options.events;} else 
        {
            // after 2s remove the delay - it's been on the screen long enough
            // at this point.
            setTimeout(function () {
                _this2.hide();
                _this2.removeHideDelay();}, 
            5000);}


        this.$(".facebookShare").qtip(options);}, 


    removeHideDelay: function () {
        this.$(".facebookShare").qtip("api").set("hide.delay", 0);}, 


    hide: function () {
        var api = this.$(".facebookShare").qtip("api");
        if (api) {
            api.hide();}} }, 


{ 
    /** Extends the badge object with email and twitter share links. */
    addShareLinksContext: function (badgeObject) {
        var url = badgeObject.absoluteUrl;
        var desc = badgeObject.translatedDescription;
        badgeObject.emailLink = Social.emailBadge(url, desc);
        badgeObject.twitterLink = Social.twitterBadge(url, desc);
        return badgeObject;} });



module.exports = Badges;
});
KAdefine("javascript/shared-package/bind-signup-link.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, no-unused-vars */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var Cookies = require("./cookies.js");
var KA = require("./ka.js");
var launchSignupInModal = require("./launch-signup-in-modal.js");

/**
 * Listen to clicks to launch the sign up modal, as allowed by the AB test and
 * u13 restrictions.
 * @param {jQuery} $el The element to bind
 * @param {function} callback Optional callback for when the modal is about to
 *      be shown.
 */
var bindSignupLink = function ($el, callback, initialRole, postloginUrl) {
    if (!KA.isPhantom()) {
        // Clicks on "Sign up" will send the user to /signup
        return;}


    if (Cookies.readCookie("u13")) {
        // If under 13, send to /signup which will show a special page
        return;}


    if (window.location.pathname === "/signup") {
        // If we're somehow on the signup page, just let them re-nav to
        // the signup page instead of showing a signup modal.
        return;}


    if (KA.isMobileCapable) {
        // If using a mobile device, re-nav to /signup. Modals aren't ideal on
        // small screens.
        return;}


    if (!$el || $el.length === 0) {
        return;}


    // Show a signup modal on click
    $el.on("click", function (e) {
        if (callback) {
            callback();}


        launchSignupInModal(initialRole, postloginUrl);

        e.preventDefault();}).
    one("mouseenter", function (e) {
        // Optimistically require things needed by launchSignupInModal
        require.async([
        "../login-package/login.js", 
        "../login-package/signup-modal.jsx", 
        "package!login.css"], 
        function () {});});};



module.exports = bindSignupLink;
});
KAdefine("javascript/shared-package/launch-signup-in-modal.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* eslint-disable comma-dangle, indent */
/* To fix, remove an entry above, run "make linc", and fix errors. */

var $ = require("jquery");
var React = require("react");
var ReactDOM = require("react-dom");

/**
 * Open the student sign up flow in a modal
 */
var launchSignupInModal = function (initialRole, postloginUrl) {
    require.async([
    "../login-package/login.js", 
    "../login-package/signup.js", 
    "../login-package/signup-modal.jsx", 
    "package!login.css"], 
    function (Login, Signup, SignupModal) {
        SignupModal = React.createFactory(SignupModal);
        var $container = $("#modal-signup-container");
        if ($container.length === 0) {
            $container = $("<div id=\"modal-signup-container\">").
            appendTo("body");}


        // Unmount if anything is there, so the modal will show on subsequent
        // attempts to launch the sign up.
        ReactDOM.unmountComponentAtNode($container[0]);

        ReactDOM.render(SignupModal({ 
            onFacebookClick: Signup._signupFacebook, 
            onGoogleClick: Signup._signupGoogle, 
            initialRole: initialRole, 
            signupSource: postloginUrl }), 
        $container[0]);});};



module.exports = launchSignupInModal;
});
KAdefine("third_party/javascript-khansrc/babeljs/babel-external-helpers.js", function(__KA_require, __KA_module, __KA_exports) {
// This file is used by code compiled with the Babel transpiler.  It's a
// collection of commonly used functions in Babel's output code.  It was
// generated using the following command:
// - node_modules/.bin/babel-external-helpers > third_party/babeljs/babel-external-helpers.js
//
// The following helpers have been removed from this file because decorators
// and async/await are not being used yet:
// - createDecoratedClass
// - createDecoratedObject
// - defineDecoratedPropertyDescriptor
// - asyncToGenerator
(function (global) {
    var babelHelpers = global.babelHelpers = {};

    babelHelpers.inherits = function (subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) subClass.__proto__ = superClass;
    };

    babelHelpers.defaults = function (obj, defaults) {
        var keys = Object.getOwnPropertyNames(defaults);

        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = Object.getOwnPropertyDescriptor(defaults, key);

            if (value && value.configurable && obj[key] === undefined) {
                Object.defineProperty(obj, key, value);
            }
        }

        return obj;
    };

    babelHelpers.createClass = (function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    })();

    babelHelpers.taggedTemplateLiteral = function (strings, raw) {
        return Object.freeze(Object.defineProperties(strings, {
            raw: {
                value: Object.freeze(raw)
            }
        }));
    };

    babelHelpers.taggedTemplateLiteralLoose = function (strings, raw) {
        strings.raw = raw;
        return strings;
    };

    babelHelpers.toArray = function (arr) {
        return Array.isArray(arr) ? arr : Array.from(arr);
    };

    babelHelpers.toConsumableArray = function (arr) {
        if (Array.isArray(arr)) {
            for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

            return arr2;
        } else {
            return Array.from(arr);
        }
    };

    babelHelpers.slicedToArray = function (arr, i) {
        if (Array.isArray(arr)) {
            return arr;
        } else if (Symbol.iterator in Object(arr)) {
            var _arr = [];
            var _n = true;
            var _d = false;
            var _e = undefined;

            try {
                for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
                    _arr.push(_s.value);

                    if (i && _arr.length === i) break;
                }
            } catch (err) {
                _d = true;
                _e = err;
            } finally {
                try {
                    if (!_n && _i["return"]) _i["return"]();
                } finally {
                    if (_d) throw _e;
                }
            }

            return _arr;
        } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
    };

    babelHelpers.slicedToArrayLoose = function (arr, i) {
        if (Array.isArray(arr)) {
            return arr;
        } else if (Symbol.iterator in Object(arr)) {
            var _arr = [];

            for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) {
                _arr.push(_step.value);

                if (i && _arr.length === i) break;
            }

            return _arr;
        } else {
            throw new TypeError("Invalid attempt to destructure non-iterable instance");
        }
    };

    babelHelpers.objectWithoutProperties = function (obj, keys) {
        var target = {};

        for (var i in obj) {
            if (keys.indexOf(i) >= 0) continue;
            if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
            target[i] = obj[i];
        }

        return target;
    };

    babelHelpers.hasOwn = Object.prototype.hasOwnProperty;
    babelHelpers.slice = Array.prototype.slice;
    babelHelpers.bind = Function.prototype.bind;

    babelHelpers.defineProperty = function (obj, key, value) {
        return Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    };

    babelHelpers.interopRequireWildcard = function (obj) {
        if (obj && obj.__esModule) {
            return obj;
        } else {
            var newObj = {};

            if (obj != null) {
                for (var key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
                }
            }

            newObj["default"] = obj;
            return newObj;
        }
    };

    babelHelpers.interopRequireDefault = function (obj) {
        return obj && obj.__esModule ? obj : {
            "default": obj
        };
    };

    babelHelpers._typeof = function (obj) {
        return obj && obj.constructor === Symbol ? "symbol" : typeof obj;
    };

    babelHelpers._extends = Object.assign || function (target) {
            for (var i = 1; i < arguments.length; i++) {
                var source = arguments[i];

                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                    }
                }
            }

            return target;
        };

    babelHelpers.get = function get(object, property, receiver) {
        var desc = Object.getOwnPropertyDescriptor(object, property);

        if (desc === undefined) {
            var parent = Object.getPrototypeOf(object);

            if (parent === null) {
                return undefined;
            } else {
                return get(parent, property, receiver);
            }
        } else if ("value" in desc) {
            return desc.value;
        } else {
            var getter = desc.get;

            if (getter === undefined) {
                return undefined;
            }

            return getter.call(receiver);
        }
    };

    babelHelpers.set = function set(object, property, value, receiver) {
        var desc = Object.getOwnPropertyDescriptor(object, property);

        if (desc === undefined) {
            var parent = Object.getPrototypeOf(object);

            if (parent !== null) {
                set(parent, property, value, receiver);
            }
        } else if ("value" in desc && desc.writable) {
            desc.value = value;
        } else {
            var setter = desc.set;

            if (setter !== undefined) {
                setter.call(receiver, value);
            }
        }

        return value;
    };

    babelHelpers.classCallCheck = function (instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    };

    babelHelpers.objectDestructuringEmpty = function (obj) {
        if (obj == null) throw new TypeError("Cannot destructure undefined");
    };

    babelHelpers.temporalUndefined = {};

    babelHelpers.temporalAssertDefined = function (val, name, undef) {
        if (val === undef) {
            throw new ReferenceError(name + " is not defined - temporal dead zone");
        }

        return true;
    };

    babelHelpers.selfGlobal = typeof global === "undefined" ? self : global;

    babelHelpers.defaultProps = function (defaultProps, props) {
        if (defaultProps) {
            for (var propName in defaultProps) {
                if (typeof props[propName] === "undefined") {
                    props[propName] = defaultProps[propName];
                }
            }
        }

        return props;
    };

    babelHelpers._instanceof = function (left, right) {
        if (right != null && right[Symbol.hasInstance]) {
            return right[Symbol.hasInstance](left);
        } else {
            return left instanceof right;
        }
    };

    babelHelpers.interopRequire = function (obj) {
        return obj && obj.__esModule ? obj["default"] : obj;
    };
})(typeof global === "undefined" ? self : global);
this.babelHelpers = babelHelpers;
});
KAdefine("javascript/shared-package/site-infra.js", function(require, module, exports) {
/* TODO(csilvers): fix these lint errors (http://eslint.org/docs/rules): */
/* To fix, remove an entry above, run "make linc", and fix errors. */

/**
 * SiteInfra.init() is initialization script for setting up client-side
 * infrastructure used by the whole website.
 *
 * This mostly exists for legacy reasons where every file in a package was
 * expected to be executed as soon as the package was loaded. We're moving away
 * from that assumption, so we need a single entry point for this
 * infrastructure instead of every file initializing themselves.
 *
 * This does things like:
 *  - Setting up Handlebars helpers used in all our templates
 *  - Setting up AJAX hooks for cache busting and i18n support
 *  - Setting up our notification system
 */
// These files must be loaded before using any ES6/ES7 features.
require("../../third_party/javascript-khansrc/core-js/shim.min.js");
require("../../third_party/javascript-khansrc/babeljs/babel-external-helpers.js");

// Install Raven error handling immediately to catch javascript errors
// (to send to Sentry) as soon as possible.
require("../../third_party/javascript-khansrc/raven-js/raven.js");

// We ignore our normal styleguiding rules here for sort order because order of
// execution is important.
var $ = require("jquery");

// Install Raven jQuery plugin immediately after jQuery so that it can
// wrap event handlers and $.ajax callbacks to catch errors
require("../../third_party/javascript-khansrc/raven-js/jquery.js");

// Install jQuery migrate plugin
require("../../third_party/javascript-khansrc/jquery-migrate/jquery-migrate-1.1.1.js");

// Install modernizer, which sets classes on <html>
require("../../third_party/javascript-khansrc/Modernizr/modernizr.js");

// Make jQuery UI work with touch events on mobile
require("../../third_party/javascript-khansrc/jqueryui/jquery.ui.touch-punch.js");

var KA = require("./ka.js");
// Mute jQuery migration logging messages in production
$.migrateMute = !KA.IS_DEV_SERVER;

// Install polyfills
require("../../third_party/javascript-khansrc/es6-promise/dist/es6-promise.js");
require("../../third_party/javascript-khansrc/fetch/fetch.js");

// Install extensions
require("./handlebars-extras.js");

require("../../third_party/javascript-khansrc/jquery-placeholder/jquery.placeholder.js");
require("../../third_party/javascript-khansrc/bootstrap-dropdown/dropdown.js");

// Ensure that ka.js has been loaded to extend the global KA object with new
// functions.
require("./ka.js");

var APIActionResults = require("./api-action-results.js");
var CSSMenus = require("./pageutil.js").CSSMenus;
var FacebookUtil = require("./facebookutil.js");
var KAConsole = require("./console.js");
var NotificationsLoader = require("./notifications-loader.js");
var PackageManager = require("./package-manager.js"); // @Nolint(PackageManager)
var Social = require("./social.js");
var TypeaheadLoader = require("./typeahead-loader.js");
var VisitTracking = require("./visit-tracking.js");

// Accessibility (a11y)
// Bring in accessibility fixes that could be used on every page
var A11y = require("./a11y.js");

var SiteInfra = { 
    _initSearch: function () {
        $(".search-form .search-input").placeholder();

        // All search boxes should only allow submission if user has entered a
        // non-empty query.
        $(".search-input").
        closest("form").
        submit(function (e) {
            return !!$.trim($(this).find(".search-input").val());});}, 



    _initUserDropdown: function () {
        // On any update to the user's nickname/points/badge area,
        // reinitialize the user dropdown.
        $("#user-info").on("userUpdate", function () {

            $(this).find(".dropdown-toggle").
            dropdown(
            // Config dropdown on click for mobile, hover otherwise
            "ontouchstart" in window ? null : "hover");}).


        trigger("userUpdate");}, 


    _onDomReady: function () {
        NotificationsLoader.init();
        APIActionResults.addDefaultHooks();
        Social.init();
        CSSMenus.init();
        TypeaheadLoader.init();
        this._initSearch();
        this._initUserDropdown();
        VisitTracking.trackVisit();}, 


    _setBlurOnEsc: function () {
        // Site wide utility to make inputs blur when the user hits
        // the escape key.
        $(document).delegate("input.blur-on-esc", "keyup", 
        function (e, options) {
            if (options && options.silent) {
                return;}

            if (e.which === 27) {
                $(e.target).blur();}});}, 




    _setupLoginLinkRedirect: function () {
        // Make links to the login page redirect to the current
        // page. In Jinja there is a global variable login_url that
        // lets a user return to the correct spot after logging
        // in. Since it's annoying to pass this around to any view
        // that needs to have a login link, the use of this variable
        // is handled in a global way here.
        //
        // If you want to opt out of this, add a class to your link
        // and make the handler below ignore links with that class.
        $(".log-in-link").click((function (e) {
            location.href = this.getLoginURL();
            e.preventDefault();}).
        bind(this));}, 


    getLoginURL: function () {
        var path = location.pathname + location.hash;
        if (path && path !== "/") {
            if (path === "/sat") {
                path = "/mission/sat";} else 
            if (path === "/signup") {
                // Clicking the login button from the signup page is a special
                // case because we want to continue from login onward to
                // wherever they were supposed to go after signup.
                var queryMatch = /continue=([^&]+)/.exec(location.search);
                if (queryMatch) {
                    return "/login?continue=" + queryMatch[1];}}


            return "/login?continue=" + encodeURIComponent(path);} else 
        {
            return "/login";}}, 



    getLogoutURL: function () {
        var path = location.pathname + location.hash;
        return "/logout?continue=" + encodeURIComponent(path);}, 


    init: function () {
        // Only execute this, at most, once
        if (this._initDone) {
            return;}


        this._initDone = true;

        this._setBlurOnEsc();
        this._setupLoginLinkRedirect();
        KAConsole.init(KA.IS_DEV_SERVER);
        PackageManager.init(); // @Nolint(PackageManager)
        APIActionResults.init();
        FacebookUtil.init();
        A11y.init();
        $(this._onDomReady.bind(this));} };



module.exports = SiteInfra;
});
; KAdefine.updatePathToPackageMap({"javascript/issues-package/issues.jsx": "issues.js", "javascript/login-package/login.js": "login.js", "javascript/login-package/signup-modal.jsx": "login.js", "javascript/login-package/signup.js": "login.js", "javascript/notifications-package/notifications.js": "notifications.js", "javascript/react-guiders-package/guider.jsx": "react-guiders.js", "javascript/typeahead-package/build-mission-source.js": "typeahead.js", "javascript/typeahead-package/render-nav-search-bar.js": "typeahead.js", "javascript/typeahead-package/search-box.jsx": "typeahead.js", "third_party/javascript-khansrc/tota11y/build/tota11y.min.js": "tota11y.js"});
