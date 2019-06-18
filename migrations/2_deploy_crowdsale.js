const ViewToken = artifacts.require('ViewToken');

module.exports = function(deployer) {
  const _name = 'View';
  const _symbol = 'VTK';
  const _decimals = 18;

  deployer.deploy(ViewToken, _name, _symbol, _decimals);
};
