KAdefine("javascript/coach-package/valid.jsx", function(require, module, exports, __KA_persistentData) {
var _templateObject = babelHelpers.taggedTemplateLiteralLoose(["query {\n    coachData {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"], ["query {\n    coachData {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"]);

var React = require("react");var _require =
require("react-apollo"),graphql = _require.graphql;
var gql = require("graphql-tag");var _require2 =

require("../shared-package/i18n.js"),$_ = _require2.$_;var

CoachExerciseReview = function (_React$Component) {babelHelpers.inherits(CoachExerciseReview, _React$Component);function CoachExerciseReview() {babelHelpers.classCallCheck(this, CoachExerciseReview);return babelHelpers.possibleConstructorReturn(this, _React$Component.apply(this, arguments));}CoachExerciseReview.prototype.










    render = function render() {var
        coachData = this.props.data.coachData;

        if (!coachData) {
            return React.createElement("div", null, $_(null, "Loading..."));
        }

        return React.createElement("div", null, coachData.studentListByName.name);
    };return CoachExerciseReview;}(React.Component);


var WrappedCoachExerciseReview = graphql(gql(_templateObject))(





CoachExerciseReview);

module.exports = WrappedCoachExerciseReview;


});

KAdefine("javascript/coach-package/syntax-error.jsx", function(require, module, exports, __KA_persistentData) {
var _templateObject = babelHelpers.taggedTemplateLiteralLoose(["query {\n    coachData() {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"], ["query {\n    coachData {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"]);

var React = require("react");var _require =
require("react-apollo"),graphql = _require.graphql;
var gql = require("graphql-tag");var _require2 =

require("../shared-package/i18n.js"),$_ = _require2.$_;var

CoachExerciseReview = function (_React$Component) {babelHelpers.inherits(CoachExerciseReview, _React$Component);function CoachExerciseReview() {babelHelpers.classCallCheck(this, CoachExerciseReview);return babelHelpers.possibleConstructorReturn(this, _React$Component.apply(this, arguments));}CoachExerciseReview.prototype.










    render = function render() {var
        coachData = this.props.data.coachData;

        if (!coachData) {
            return React.createElement("div", null, $_(null, "Loading..."));
        }

        return React.createElement("div", null, coachData.studentListByName.name);
    };return CoachExerciseReview;}(React.Component);


var WrappedCoachExerciseReview = graphql(gql(_templateObject))(





CoachExerciseReview);

module.exports = WrappedCoachExerciseReview;


});

KAdefine("javascript/coach-package/schema-error.jsx", function(require, module, exports, __KA_persistentData) {
var _templateObject = babelHelpers.taggedTemplateLiteralLoose(["query {\n    fooData {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"], ["query {\n    coachData {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"]);

var React = require("react");var _require =
require("react-apollo"),graphql = _require.graphql;
var gql = require("graphql-tag");var _require2 =

require("../shared-package/i18n.js"),$_ = _require2.$_;var

CoachExerciseReview = function (_React$Component) {babelHelpers.inherits(CoachExerciseReview, _React$Component);function CoachExerciseReview() {babelHelpers.classCallCheck(this, CoachExerciseReview);return babelHelpers.possibleConstructorReturn(this, _React$Component.apply(this, arguments));}CoachExerciseReview.prototype.










    render = function render() {var
        coachData = this.props.data.coachData;

        if (!coachData) {
            return React.createElement("div", null, $_(null, "Loading..."));
        }

        return React.createElement("div", null, coachData.studentListByName.name);
    };return CoachExerciseReview;}(React.Component);


var WrappedCoachExerciseReview = graphql(gql(_templateObject))(





CoachExerciseReview);

module.exports = WrappedCoachExerciseReview;


});

KAdefine("javascript/coach-package/variables.jsx", function(require, module, exports, __KA_persistentData) {
var _templateObject = babelHelpers.taggedTemplateLiteralLoose(["query($name: String) {\n    coachData {\n      studentListByName(name: $name) {\n        name\n      }\n    }\n}"], ["query {\n    coachData {\n      studentListByName(name: \"Test Class 1\") {\n        name\n      }\n    }\n}"]);

var React = require("react");var _require =
require("react-apollo"),graphql = _require.graphql;
var gql = require("graphql-tag");var _require2 =

require("../shared-package/i18n.js"),$_ = _require2.$_;var

CoachExerciseReview = function (_React$Component) {babelHelpers.inherits(CoachExerciseReview, _React$Component);function CoachExerciseReview() {babelHelpers.classCallCheck(this, CoachExerciseReview);return babelHelpers.possibleConstructorReturn(this, _React$Component.apply(this, arguments));}CoachExerciseReview.prototype.










    render = function render() {var
        coachData = this.props.data.coachData;

        if (!coachData) {
            return React.createElement("div", null, $_(null, "Loading..."));
        }

        return React.createElement("div", null, coachData.studentListByName.name);
    };return CoachExerciseReview;}(React.Component);


var WrappedCoachExerciseReview = graphql(gql(_templateObject))(





CoachExerciseReview);

module.exports = WrappedCoachExerciseReview;


});