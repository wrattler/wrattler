module Wrattler.Gamma.Ast

open Fable.Import
open Fable.Import.JS
open Wrattler.Imports

// ------------------------------------------------------------------------------------------------
// Tokens and common 
// ------------------------------------------------------------------------------------------------

/// Binary operators (Equals is tokenized as separate token, but after parsing it can be operator)
type [<RequireQualifiedAccess>] Operator = 
  | Equals
  | Modulo
  | Plus
  | Minus
  | Multiply
  | Divide
  | Power
  | GreaterThan
  | LessThan
  | GreaterThanOrEqual
  | LessThanOrEqual

/// Tokens produced by tokenizer
type [<RequireQualifiedAccess>] TokenKind = 
  | LParen
  | RParen
  | Equals
  | Dot
  | Comma
  | Let
  | LSquare
  | RSquare
  | Colon
  | Fun
  | Arrow
  | Operator of Operator
  | Boolean of bool
  | Number of string * float
  | String of string
  | Ident of string
  | QIdent of string
  | White of string
  | Newline
  | Error of char
  | EndOfFile

/// Token with a range
type Token = 
  { Token : TokenKind 
    Range : Range }

// ------------------------------------------------------------------------------------------------
// Types and code generation
// ------------------------------------------------------------------------------------------------

type Emitter = 
  { Emit : Babel.Expression (* Babel.Expression list *) -> Babel.Expression }

type [<RequireQualifiedAccess>] Documentation = 
  | Text of string
  | Details of string * string
  | None 

type Member = 
  { Name : string 
    Type : Type 
    Emitter : Emitter }

and ObjectType = 
  abstract Members : Member[] 
  abstract TypeEquals : ObjectType -> bool

and [<RequireQualifiedAccess>] PrimitiveType = 
  | Number
  | Date
  | String
  | Bool
  | Unit

and MethodArgument =
  { Name : string
    Optional : bool
    Static : bool
    Type : Type }

and [<RequireQualifiedAccess>] GammaType =
  | Delayed of Promise<Type>
  | Object of ObjectType
  | Primitive of PrimitiveType
  | List of elementType:Type
  | Method of arguments:MethodArgument list * typ:((GammaType * Value option) list -> GammaType option) 
  | Any
  interface Type

// ------------------------------------------------------------------------------------------------
// Entities - binder attaches those to individual constructs in the parsed AST
// ------------------------------------------------------------------------------------------------

/// Represents constants that can appear in the code
/// (We create separate entity for each, so that we can calculate
/// values of entities and not just types)
type [<RequireQualifiedAccess>] Constant = 
  | Number of float
  | String of string
  | Boolean of bool
  | Empty

/// Name of an entity, variable, member, or another syntactic construct
type Name = string

/// Represents different kinds of entities that we create. Roughhly
/// corresponds to all places in code where something has a name.
type [<RequireQualifiedAccess>] GammaNodeKind = 

  // Entities that represent root node, program and commands
  | Program of commands:Node list
  | RunCommand of body:Node
  | LetCommand of variable:Node * export:Node * assignment:Node
  
  // Standard constructs of the language
  | List of elements:Node list
  | Constant of Constant
  | Function of variable:Node * body:Node
  | Operator of left:Node * operator:Operator * right:Node

  /// Reference to a global symbol or a local variable
  | GlobalValue of name:Name * Babel.Expression option 
  | Variable of name:Name * value:Node

  /// Variable binding in lambda abstraction
  | Binding of name:Name * callSite:Node
  /// Call site in which a lambda function appears. Marks method reference & argument
  /// (the argument is the name or the index of the parameter in the list)
  | CallSite of instance:Node * parameter:Choice<string, int>

  /// Represents all arguments passed to method; Antecedants are individual arguments
  /// (a mix of named parameter & ordinary expression entities)
  | ArgumentList of arguments:Node list
  /// Named param in a call site with an expression assigned to it
  | NamedParam of name:Name * assignment:Node

  /// Placeholder with its name and the body Node
  | Placeholder of name:Name * body:Node

  /// Member access and call with arguments (call has member access 
  /// as the instance; second argument of Member is MemberName)
  | Call of instance:Node * arguments:Node
  | Member of instance:Node * name:Node 
  | MemberAccess of membr:Node
  | MemberName of name:Name

// ------------------------------------------------------------------------------------------------
// Parsed AST 
// ------------------------------------------------------------------------------------------------

/// Method call argument, optionally with a named
type Argument =
  { Name : Syntax<Name> option
    Value : Syntax<Expr> }

/// A program is a list of commands (with range info)
and Program = 
  { Body : Syntax<Syntax<Command> list> }

/// Variable binding or an expression
and Command = 
  | Let of Syntax<Name> * Syntax<Expr>
  | Expr of Syntax<Expr>

/// An expression (does not include let binding, which is a command)
and [<RequireQualifiedAccess>] Expr = 
  | Variable of Syntax<Name>
  | Member of Syntax<Expr> * Syntax<Expr>
  | Call of Syntax<Expr> * Syntax<Argument list>
  | Function of Syntax<Name> * Syntax<Expr>
  | Placeholder of Syntax<Name> * Syntax<Expr>
  | String of string
  | Number of float
  | Boolean of bool
  | Binary of Syntax<Expr> * Syntax<Operator> * Syntax<Expr>
  | List of Syntax<Expr> list
  | Empty
