KAdefine("javascript/server-package/test-component.jsx", function(require, module, exports) {
var React = require("react");

var TestComponent = React.createClass({ displayName: "TestComponent", 
    render: function () {
        return React.createElement("div", null, 
        this.props.val, 
        React.createElement("ol", null, 
        this.props.list.map(function (val) {return React.createElement("li", { key: val }, val);})));} });





module.exports = TestComponent;
});
