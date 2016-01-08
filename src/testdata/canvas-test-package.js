KAdefine("javascript/canvas-test-package/test-component.jsx", function(require, module, exports) {
var React = require("react");
// This is the core of our test: require qTip and make sure it doesn't
// crash (that is, that it correctly enters 'no-canvas' mode).
require("../../third_party/javascript-khansrc/qTip2/jquery.qtip.js");

var TestComponent = React.createClass({ displayName: "TestComponent", 
    render: function () {
        return React.createElement("div", null, 
        this.props.val, 
        React.createElement("ol", null, 
        this.props.list.map(function (val) {return React.createElement("li", { key: val }, val);})));} });





module.exports = TestComponent;
});
