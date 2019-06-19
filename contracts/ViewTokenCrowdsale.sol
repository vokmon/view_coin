pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol';
import 'openzeppelin-solidity/contracts/crowdsale/emission/MintedCrowdsale.sol';

contract ViewTokenCrowdsale is Crowdsale, MintedCrowdsale {
  constructor(uint256 _rate, address payable _wallet, IERC20 _token)
  Crowdsale(_rate, _wallet, _token)
  public {

  }
}