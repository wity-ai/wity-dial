These are orthogonal systems operating at different layers — and that's exactly what makes them composable.

  What each does

  ┌─────────────────────┬─────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┐
  │                     │                     MCP                     │                                         DIAL                                          │
  ├─────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Layer               │ Capability / plumbing                       │ Discourse / conversation                                                              │
  ├─────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Question it answers │ "How does an AI access tools and data?"     │ "How does an AI structure what it says and does?"                                     │
  ├─────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Primitives          │ Tools, Resources, Prompts                   │ 8 speech acts (inform, ask, suggest, execute, declare, acknowledge, delegate, phatic) │
  ├─────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Direction           │ AI → external systems (outbound invocation) │ AI → participants (structured response)                                               │
  ├─────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ Wire format         │ JSON-RPC                                    │ XML (but format isn't fundamental)                                                    │
  ├─────────────────────┼─────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
  │ State model         │ Stateless per-request (server holds state)  │ Session-aware (turns, actors, declared context)                                       │
  └─────────────────────┴─────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┘

  The key distinction

  MCP is about capability access — it gives the AI a way to discover and invoke tools, read data sources, and use prompt templates. It's the plumbing between the model and the world.

  DIAL is about discourse structure — it encodes what the AI is doing communicatively in each turn. Not "call this function" but "I'm informing you / asking you / suggesting an action /
  declaring a fact / delegating to another actor."

  MCP doesn't care how the AI talks to the user. DIAL doesn't care how the AI accesses external systems.

  How they compose

  This is where it gets interesting. They're not just non-overlapping — they actively complement each other:

  1. <dial-execute> steps could be backed by MCP tools

  Right now your dial-execute steps use env="shell" / env="python" / env="http" — the executor runs raw commands. An MCP-backed executor could route steps to MCP tool servers instead:

  <dial-execute yield="done">
    <step env="mcp:github" id="s1" yield="pr:created">
      create-pull-request --title "Fix bug" --base main
    </step>
    <step env="mcp:slack" observe="pr:created" yield="notified">
      send-message --channel #eng --text "PR created: {{s1.result.url}}"
    </step>
  </dial-execute>

  DIAL's observe/yield graph gives you dependency orchestration that MCP alone doesn't have. MCP tools are individual calls; DIAL lets you express "do A, then when A yields, do B."

  2. <dial-suggest> could surface MCP-discovered capabilities

  MCP's tool discovery tells the AI what it can do. DIAL's dial-suggest lets the AI propose those actions to the user with structured preview/confirm UX — which is exactly what your
  studios already do.

  3. <dial-delegate> maps naturally to MCP server routing

  <dial-delegate to="design-agent" intent="generate-images"> is a discourse-level handoff. MCP could be the transport that actually routes it to the right server.

  4. MCP Resources → DIAL context injection

  Your audit flagged that every app reinvents context injection (<dial-context>, [ENV], <system>). MCP Resources could standardize how context is fetched, while DIAL would still structure
  how it's used in conversation.

  The layering

  ┌─────────────────────────────────────────┐
  │  App (studio, CLI, game, careers)       │  ← consumer
  ├─────────────────────────────────────────┤
  │  DIAL — discourse structure             │  ← what is being communicated
  │  (inform, ask, suggest, execute, ...)   │
  ├─────────────────────────────────────────┤
  │  MCP — capability access                │  ← how AI reaches tools & data
  │  (tools, resources, prompts)            │
  ├─────────────────────────────────────────┤
  │  LLM                                    │  ← generation
  └─────────────────────────────────────────┘

  What DIAL has that MCP doesn't

  - Multi-party turn structure (actor, session, turn, addressed-to)                                                                                                                         
  - Observe/yield dependency graphs — parallel-by-default, sequential-when-needed
  - Speech act semantics — the difference between informing, asking, suggesting, and declaring                                                                                              
  - Blocking vs non-blocking (ask blocks, suggest doesn't) — conversational flow control                                                                                                    
                                                                                                                                                                                            
  What MCP has that DIAL doesn't                                                                                                                                                            
                                                                                                                                                                                            
  - Tool discovery — dynamic capability enumeration                                                                                                                                         
  - Resource abstraction — URI-based data access
  - Server lifecycle management — connect/disconnect, capability negotiation                                                                                                                
  - Ecosystem momentum — broad adoption across AI tooling                                                                                                                                   
                                                                                                                                                                                            
  TL;DR                                                                                                                                                                                     
                                                                                                                                                                                            
  They're not competitors. MCP is the AI's hands (reaching into external systems). DIAL is the AI's mouth (structuring what it says and does in conversation). An AI can use MCP to get     
  capabilities and DIAL to express how it uses them in discourse. The most natural composition point is dial-execute steps backed by MCP tools, with DIAL's observe/yield graph providing
  the orchestration layer that MCP lacks.                                                                                                                                                   
                                                                                                                                                                                          
❯ so we can integrate MCP servers in our DIAL system or vice versa or what                                                                                                                  
                                                                           
● Both directions work, but they serve different purposes. Let me be concrete about what each looks like.                                                                                   
                                                                                                                                                                                          
  Direction 1: MCP tools inside DIAL (most natural)                                                                                                                                         
   
  DIAL's dial-execute already has an env attribute (shell, python, http). Adding env="mcp" is a straightforward extension — each step becomes an MCP tool call, and DIAL's observe/yield    
  graph orchestrates them:                                                                                                                                                                
                                                                                                                                                                                            
  <dial-execute yield="done">                                                                                                                                                             
    <step env="mcp:filesystem" id="s1" yield="files:read">
      read_file --path ./src/config.ts                                                                                                                                                      
    </step>
    <step env="mcp:github" observe="files:read" yield="issue:created">                                                                                                                      
      create_issue --title "Config needs update" --body "{{s1.result}}"                                                                                                                     
    </step>                                                                                                                                                                                 
  </dial-execute>                                                                                                                                                                           
                                                                                                                                                                                            
  What DIAL adds over raw MCP calls:                                                                                                                                                        
  - Dependency ordering — step 2 waits for step 1 via observe/yield
  - Parallel-by-default — steps without observe run concurrently                                                                                                                            
  - Conversational framing — the execute block is part of a larger turn that also informs, asks, suggests                                                                                 
                                                                                                                                                                                            
  This is essentially what wity-cli already does with env="shell" — you'd add an MCP executor alongside ShellExecutor.                                                                      
                                                                                                                                                                                            
  Direction 2: DIAL as an MCP server                                                                                                                                                        
                                                                                                                                                                                            
  You could expose DIAL parsing + session as an MCP server that any MCP client can use:                                                                                                     
                                                                                                                                                                                          
  MCP Tool: dial_parse(text) → DialEnvelope                                                                                                                                                 
  MCP Tool: dial_session_declare(key, value)                                                                                                                                                
  MCP Tool: dial_session_get_declared() → Record                                                                                                                                            
  MCP Resource: dial://session/{id}/context                                                                                                                                                 
                                                                                                                                                                                            
  This would let any MCP-compatible app (Cursor, Claude Desktop, etc.) use DIAL parsing without importing @wity.ai/dial. But honestly — this is mostly wrapping a library in a server for   
  the sake of protocol compliance. Only worth it if you want DIAL available to tools that can't import npm packages.                                                                        
                                                                                                                                                                                            
  Direction 3: The one that actually matters for your ecosystem                                                                                                                             
   
  Looking at your audit, the real integration point is the widget bridge. Right now:                                                                                                        
                                                                                                                                                                                          
  LLM → raw text → widget parses DIAL → onDialEvent() → studio handlers                                                                                                                     
                                                                                                                                                                                            
  If the widget also connected to MCP servers, the flow becomes:                                                                                                                            
                                                                                                                                                                                            
  LLM → DIAL response → widget parses it                                                                                                                                                    
    → dial-inform/ask/suggest → studio UI handlers (unchanged)                                                                                                                            
    → dial-execute steps → MCP tool calls (new capability)                                                                                                                                  
   
  The studios would gain execution capability without building their own executors. The widget becomes both DIAL parser and MCP client.                                                     
                                                                                                                                                                                          
  What I'd actually do                                                                                                                                                                      
                                                                                                                                                                                          
  Direction 1 only, and specifically:                                                                                                                                                       
   
  1. Add env="mcp" (or env="mcp:{server}") as a recognized step environment in the DIAL spec                                                                                                
  2. Add an McpExecutor in wity-cli alongside ShellExecutor — when runStepGraph hits an MCP step, it routes to the configured MCP server                                                  
  3. Leave the studios alone for now — they don't use dial-execute at all, and their suggest+declare pattern doesn't need MCP                                                               
                                                                                                                                                                                            
  The reason: MCP gives you tool breadth (filesystem, GitHub, Slack, databases — all via community servers). DIAL gives you orchestration and discourse. Plugging MCP tools into DIAL's     
  execute graph gets you both without rearchitecting anything. The reverse direction (DIAL as MCP server) is a nice-to-have but doesn't solve a real problem today.                         
                                                                                                                                                                                            
  The key question for your ecosystem is: do any of your consumers actually need to call external tools mid-conversation? wity-cli already does (via shell). The studios don't — they just  
  mutate app state. If a studio ever needs to call an external service as part of a DIAL action, that's when MCP-inside-DIAL becomes worth building.
                                                 
                                                                                                                                                                                            
❯ so mcp is just another environment in that sense                                                                                                                                          
                                                    
● Exactly. From DIAL's perspective, MCP is just another env — same as shell, python, or http. DIAL doesn't care what executes the step, it cares about the dependency graph between steps   
  and how execution fits into the larger conversational turn.                                                                                                                             
                                                                                                                                                                                            
  <dial-execute yield="done">                                                                                                                                                               
    <step env="shell" id="s1" yield="built">npm run build</step>                                                                                                                            
    <step env="mcp:github" observe="built" yield="pushed">create_pr --title "Release"</step>                                                                                                
    <step env="mcp:slack" observe="pushed">post --channel #releases --text "Shipped"</step>                                                                                                 
  </dial-execute>                                                                                                                                                                           
                                                                                                                                                                                            
  Three different execution environments, one dependency graph. DIAL orchestrates, each env just runs its step.                                                                             
                                                                                                                                                                                            
  That's the architectural relationship — MCP sits below DIAL as a pluggable executor, not beside it as a peer protocol. DIAL is the conversation. MCP is one of the hands.    