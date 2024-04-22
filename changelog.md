# CHANGES

## BIG CHANGES

- Added a check if the user is already signed in

- Implemented a logger

## SMALLER CHANGES

- Switched from var to const and let to introduce block scope instead of block scope

- Updated the copy to clipboard function to use the new navigator api

- Added JSDoc to the api/socket functions

- I also ran a prettier to format the code and make it more readable

## HOW I DID IT

### BIG CHANGES EXPLAINED

1. Added a check if the user is already signed in: This was made because the ui was displaying the name twice on login and persisted if you relogged in. This can also help in maintaining the user's session and state across different pages and reduce the redundancy of adding the user multiple times to the UI.

2. Implemented a logger: The usage of console.log in production can be a performance bottleneck. By implementing a logger, we can reduce the impact of console.log in production. The logger logs to the logs folder with errors separated, and if the NODE_ENV is set to production, the logger will not display in the console to save resources.

### SMALLER CHANGES EXPLAINED

1. Switched from var to const and let to introduce block scope instead of function scope: var is function-scoped, meaning it's available throughout the entire function it's declared in. let and const are block-scoped, meaning they're only available within the block they're declared in. This can help prevent bugs related to variable hoisting and unintended variable reassignment.

2. Updated the copy to clipboard function to use the new navigator api: The new navigator API provides a more modern and efficient way to copy text to the clipboard. It's more secure and flexible than the older document.execCommand('copy') method.

3. Added JSDoc to the api/socket functions: Adding JSDoc comments to your functions can make your code easier to understand and maintain. It can also provide enhanced intellisense and type checking in the editor.
