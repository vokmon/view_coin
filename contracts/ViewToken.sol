pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Pausable.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';

contract ViewToken is ERC20, ERC20Detailed, ERC20Mintable, ERC20Pausable, Ownable {
  constructor(string memory _name, string memory _symbol, uint8 _decimals)
  ERC20Detailed(_name, _symbol, _decimals) public {

  }

  function removeMinter(address account) public onlyMinter {
    super._removeMinter(account);
  }

  function removePauser(address account) public onlyPauser {
    super._removePauser(account);
  }
}