KAdefine("javascript/polyfill-package/test-component.jsx", function(require, module, exports) {
var React = require("react");

var PDC = React.createClass({ displayName: "PDC", 
    render: function () {
        return React.createElement("div", null, "" + this.props.array.includes(1));} });



module.exports = PDC;
});
