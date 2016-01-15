KAdefine("javascript/server-package/test-component.jsx", function(require, module, exports) {
var React = require("react");var _require = 
require("aphrodite");var StyleSheet = _require.StyleSheet;var css = _require.css;

var TestComponent = React.createClass({ displayName: "TestComponent", 
    render: function () {
        return React.createElement("div", null, 
        this.props.val, 
        React.createElement("ol", { className: css(styles.red) }, 
        this.props.list.map(function (val) {return React.createElement("li", { key: val }, val);})));} });





var styles = StyleSheet.create({ 
    red: { 
        color: "red" } });



module.exports = TestComponent;
});
