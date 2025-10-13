# Roblox Askeri Kamp Discord Botu

## Overview

A Discord bot designed to manage Roblox military camp groups through Discord commands. The bot integrates Discord with Roblox's API to query and manage group ranks, promotions, and member information. It uses slash commands for user interaction and requires administrative role verification for certain operations.

The bot provides comprehensive management features:
- Rank management with Roblox usernames (query, change, promote, demote)
- Discord user ban/unban using Discord user IDs
- Game activity monitoring for the group's Roblox game

**Recent Changes**:

*October 13, 2025*:
- **Rank Permission System Update**: Changed rank management permissions to use specific rank levels
- Only ranks 35, 36, 37, and 38 can now perform rank management operations
- Removed `minRankToManage` parameter in favor of `allowedRanks` whitelist
- **Account Linking System Enhancement**: Improved Roblox account linking with one-time binding
- `/roblox-bağla` command now only works once - prevents re-linking if account is already bound
- Added new `/roblox-değiştir` command to allow users to change their linked Roblox account
- Both commands use the same secure verification system (profile description code)
- Updated error handling to properly handle deferred/replied interactions

*October 12, 2025*:
- **Discord.js Deprecation Fix**: Updated `ready` event to `clientReady` for v15 compatibility
- **Roblox Rank-Based Permission System**: Completely redesigned the rank management system to use Roblox group ranks instead of Discord roles for permissions
- Added `checkRankPermissions()` helper function to validate manager's Roblox rank before allowing rank changes
- Updated all rank management commands (`/rütbe-değiştir`, `/rütbe-terfi`, `/rütbe-tenzil`) to require manager's Roblox username for permission verification
- Added `minRankToManage` and `maxRankCanAssign` configuration parameters for flexible rank permission control
- Managers can now only assign ranks up to their own rank level or the configured maximum
- Added X-CSRF token handling for Roblox API state-changing requests
- Implemented null safety checks for API responses
- Configured ban/unban commands to work with Discord user IDs instead of Roblox usernames
- Set up workflow for automatic bot deployment

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Discord Bot Interface**: Uses Discord.js v14 with slash commands for user interaction
- **Command Structure**: Slash commands for rank queries, rank changes, and promotions
- **Embed Responses**: Rich embeds for displaying rank information and status updates

### Backend Architecture
- **Runtime**: Node.js application
- **Bot Framework**: Discord.js v14 with Gateway Intents for guild management, messages, and member data
- **API Integration Layer**: Custom Roblox API wrapper (`src/roblox.js`) for handling all Roblox-related operations
- **Command Handler**: Slash command registration and handling through Discord REST API

**Key Design Decisions**:
- Slash commands over traditional prefix commands for better UX and Discord's recommended approach
- Modular API wrapper for Roblox integration to separate concerns
- Environment variables for sensitive credentials (Discord token, Roblox cookie)
- Configuration file for group-specific settings that may change

### Authentication & Authorization
- **Discord Authentication**: Bot token authentication via environment variables
- **Roblox Authentication**: `.ROBLOSECURITY` cookie for group management operations
- **Rank Permission System**: Roblox group rank-based access control for rank management commands
  - Managers must have at least `minRankToManage` rank level to manage ranks
  - Managers can only assign ranks up to their own rank or `maxRankCanAssign`, whichever is lower
  - Permission verification happens via manager's Roblox username provided in each command
- **Discord Role Permission System**: Discord role-based access control using `adminRoleId` for ban/unban commands only
- **Required Bot Permissions**: Server Members Intent, Message Content Intent, Send Messages, Embed Links, Ban Members, Slash Commands

### Data Storage
- **Configuration Storage**: JSON file (`config.json`) for group ID, game ID, and admin role ID
- **No Database**: Currently operates statelessly with all data fetched from APIs in real-time
- This approach prioritizes simplicity but may need caching or database layer for scalability

**Rationale**: The stateless approach avoids database overhead for a bot focused on real-time API queries, though this may cause rate limiting issues at scale.

## External Dependencies

### Third-Party Services
1. **Discord API**
   - Purpose: Bot communication, slash commands, guild management
   - Library: discord.js v14.23.2
   - Required Intents: Guilds, GuildMessages, MessageContent, GuildMembers, GuildBans

2. **Roblox API**
   - Purpose: User lookup, group rank management, game activity tracking
   - Endpoints Used:
     - `users.roblox.com` - Username to user ID conversion
     - `groups.roblox.com` - Group roles and member management
     - `games.roblox.com` - Game activity queries
   - Authentication: ROBLOSECURITY cookie for authenticated endpoints

### NPM Packages
- `discord.js` (^14.23.2) - Discord bot framework
- `@discordjs/rest` (^2.6.0) - Discord REST API wrapper
- `discord-api-types` (^0.38.29) - TypeScript types for Discord API
- `axios` (^1.12.2) - HTTP client for Roblox API requests

### Environment Variables
- `DISCORD_TOKEN` - Discord bot authentication token
- `DISCORD_CLIENT_ID` - Discord application ID for command registration
- `ROBLOX_COOKIE` - Roblox session cookie for group management operations

### Configuration Dependencies
- `groupId` - Target Roblox group identifier
- `gameId` - Roblox game Universe ID for activity tracking
- `adminRoleId` - Discord role ID with administrative permissions for ban/unban commands
- `minRankToManage` - Minimum Roblox group rank level required to manage other members' ranks
- `maxRankCanAssign` - Maximum rank level that managers can assign to others