KAdefine("javascript/globals-package/test-component.jsx", function(require, module, exports) {
var React = require("react");

var TestComponent = React.createClass({ displayName: "TestComponent", 
  render: function () {
    return React.createElement("div", null, 
    window.KA.language, ":", window.location.href);} });




module.exports = TestComponent;
});
