/*******************************************************************************
*                                                                              *
*                            Note Stickers Runtime                             *
*                                                                              *
*******************************************************************************/

  import { ProtoUX, DragRecognizerFor } from 'protoux'

  import { render, html, Component } from 'htm/preact'

  import hyperactiv from 'hyperactiv'
  const  { observe, computed } = hyperactiv

  import {
    throwError,
    SNS_Name, SNS_Text, SNS_Geometry, SNS_Position,
    SNS_Visual, SNS_Folder, SNS_Project, SNS_Board, SNS_Sticker,
    SNS_Change, SNS_Error,
    ValueIsName,
    allowBoard
  } from 'shareable-note-stickers'

  import { SNS_BoardView } from 'sns-boardview'

/**** make some existing types indexable ****/

  interface Indexable { [Key:string]:any }

/**** define serializable types ****/

  type serializableValue  = null | boolean | number | string |
                            serializableObject | serializableArray
  type serializableObject = { [Key:string]:serializableValue }
  type serializableArray  = serializableValue[]
  type Serializable       = serializableObject

  const PUX = new ProtoUX()

//------------------------------------------------------------------------------
//--                             Applet Registry                              --
//------------------------------------------------------------------------------

  type SNS_AppletRegistry    = { [Name:string]:SNS_AppletObservables }
  type SNS_AppletObservables = {
    Project:SNS_Project,
    chosenBoard:SNS_Board|undefined,
    StickerList:SNS_Sticker[],
    selectedStickers:SNS_Sticker[],
    StickerSelectionGeometries:SNS_Geometry[],
    SnapToGrid:boolean,
    GridWidth: number,
    GridHeight:number,
    VisitHistory:SNS_Board[],
    VisitIndex:number,                  // points to the currently visited board
    View:Component,
    ViewState:number,
    ConsoleIsOpen:boolean,
    ConsoleGeometry:SNS_Geometry,
    ConsoleValue:SNS_Text,
    ConsoleLineCount:number,
    ConsoleCharCount:number,
    Application:Indexable,
  }

  const AppletRegistry:SNS_AppletRegistry = Object.create(null)

/**** visitBoard ****/

  function visitBoard (Applet:Indexable, Board:SNS_Board):void {
    allowBoard('board to visit',Board)
    if (Board == null) { Board = Applet.Project.BoardList[0]}

    if (Board == null) {
      Applet.VisitHistory = []
      Applet.VisitIndex   = -1

      Applet.chosenBoard      = undefined
      Applet.StickerList      = []
      Applet.selectedStickers = []

      Applet.View.rerender()
    } else {
      if (! Board.isAttached) throwError(
        'NotAttached: the given board is no longer attached'
      )

      if (Board.Project !== Applet.Project) throwError(
        'NotAttached: the given board is not attached to this project'
      )

      if (Applet.VisitHistory[Applet.VisitIndex] === Board) { return }

      Applet.VisitIndex += 1
      if (Applet.VisitHistory[Applet.VisitIndex] !== Board) {
        Applet.VisitHistory.length             = Applet.VisitIndex+1
        Applet.VisitHistory[Applet.VisitIndex] = Board
      }

      Applet.chosenBoard      = Board
      Applet.StickerList      = []
      Applet.selectedStickers = []

      Applet.View.rerender()
    }
  }

/**** visitPrevBoard ****/

  function visitPrevBoard (Applet:Indexable):void {
    if (Applet.VisitIndex > 0) {
      Applet.VisitIndex -= 1

      Applet.chosenBoard      = Applet.VisitHistory[Applet.VisitIndex]
      Applet.StickerList      = []
      Applet.selectedStickers = []

      Applet.View.rerender()
    }
  }

/**** visitNextBoard ****/

  function visitNextBoard (Applet:Indexable):void {
    if (Applet.VisitIndex < Applet.VisitHistory.length-1) {
      Applet.VisitIndex += 1

      Applet.chosenBoard      = Applet.VisitHistory[Applet.VisitIndex]
      Applet.StickerList      = []
      Applet.selectedStickers = []

      Applet.View.rerender()
    }
  }

/**** validateVisitHistory ****/

  function validateVisitHistory (Applet:Indexable):void {
    let VisitHistory:SNS_Board[] = Applet.VisitHistory    // reference, not copy
    for (let i = VisitHistory.length-1; i >= 0; i--) {
      if ((VisitHistory[i] == null) || ! VisitHistory[i].isAttached) {
        VisitHistory.splice(i,1)
        if (Applet.VisitIndex >= i) { Applet.VisitIndex -= 1 }
      }
    }
    if ((Applet.VisitIndex < 0) && (VisitHistory.length > 0)) {
      Applet.VisitIndex = 0
    }

    visitBoard(Applet, VisitHistory[Applet.VisitIndex] || Applet.Project.BoardList[0])
  }

/**** showConsole ****/

  function showConsole (Applet:Indexable):void {
    if (! Applet.ConsoleIsOpen) {
      Applet.ConsoleIsOpen = true
      Applet.View.rerender()
    }
  }

/**** hideConsole ****/

  function hideConsole (Applet:Indexable):void {
    if (Applet.ConsoleIsOpen) {
      Applet.ConsoleIsOpen = false
      Applet.View.rerender()
    }
  }

/**** clearConsole ****/

  function clearConsole (Applet:Indexable):void {
    Applet.ConsoleValue = ''

    Applet.ConsoleLineCount = 0
    Applet.ConsoleCharCount = 0
  }

/**** print ****/

  function print (Applet:Indexable, ...ArgList:any[]):void {
    appendToConsole(Applet,StringFromArguments(ArgList))
  }

/**** println ****/

  function println (Applet:Indexable, ...ArgList:any[]):void {
    appendToConsole(Applet,StringFromArguments(ArgList.concat('\n')))
  }

/**** appendToConsole ****/

  function appendToConsole (Applet:Indexable, fullText:string):void {
    if (fullText === '') { return }                      // nothing to be output

    let LineCount:number = EOLCount(fullText)
    let CharCount:number = fullText.length

    if ((LineCount > Applet.ConsoleLineLimit) || (CharCount > Applet.ConsoleCharLimit)) {
      clearConsole(Applet)

      fullText = compacted(Applet, fullText, LineCount, CharCount)
        Applet.ConsoleLineCount = EOLCount(fullText)+1 // count 1st line as well
        Applet.ConsoleCharCount = fullText.length
      Applet.ConsoleValue = fullText
    } else {
      compactFor(Applet, LineCount, CharCount)

      Applet.ConsoleLineCount += LineCount
      Applet.ConsoleCharCount += CharCount

      Applet.ConsoleValue += fullText
    }
    Applet.View.rerender()
  }

/**** compacted ****/

  function compacted (
    Applet:Indexable, Candidate:string, LineCount:number, CharCount:number
  ):string {
    let LinesToSkip:number = LineCount-Applet.ConsoleLineLimit
    let CharsToSkip:number = CharCount-Applet.ConsoleCharLimit

    for (let EOLCount = 0, curIndex = -1;;) {
      curIndex = Candidate.indexOf('\n',curIndex+1)            // must be <> -1!
      EOLCount += 1

      if ((EOLCount >= LinesToSkip) && (curIndex >= CharsToSkip)) {
        return Candidate.slice(curIndex+1)
      }
    }
  }

/**** compactFor ****/

  function compactFor (
    Applet:Indexable, LineCount:number, CharCount:number
  ):void {
    let LinesToSkip:number = Applet.ConsoleLineCount+LineCount - Applet.ConsoleLineLimit
    let CharsToSkip:number = Applet.ConsoleCharCount+CharCount - Applet.ConsoleCharLimit

    if ((LinesToSkip <= 0) && (CharsToSkip <= 0)) { return }

    let Content:string = Applet.ConsoleValue
    for (let EOLCount = 0, curIndex = -1;;) {
      curIndex = Content.indexOf('\n',curIndex+1)                // might be -1!
      if (curIndex < 0) {                   // no more EOLs, just a loooong line
        clearConsole(Applet)
        return
      }

      EOLCount += 1

      if ((EOLCount >= LinesToSkip) && (curIndex-EOLCount*28 >= CharsToSkip)) {
        Applet.ConsoleValue = Content.slice(curIndex+1)
        return
      }
    }
  }

/**** EOLCount ****/

  function EOLCount (Candidate:string):number {
    let MatchList:any[]|null = Candidate.match(/\n/g)
    return (MatchList === null ? 0 : MatchList.length)
  }

/**** StringFromArguments ****/

  function StringFromArguments (ArgList:any[]):string {
    let Result:string = ''
      for (let i = 0; i < ArgList.length; i++) {
        let Argument:any = ArgList[i]
        switch (typeof(Argument)) {
          case 'undefined': Result += '(undefined)';       break
          case 'boolean':   Result += Argument.toString(); break
          case 'number':    Result += Argument.toString(); break
          case 'string':    Result += Argument;            break
          case 'function':  Result += '(function)';        break
          case 'object':    Result += (
                              Argument === null ? '(null)' : Argument.toString()
                            );                             break
          default:          Result += '(unknown)';         break
        }
      }
    return Result
  }//------------------------------------------------------------------------------
//--                           NoteStickers Startup                           --
//------------------------------------------------------------------------------

/**** startup ****/

  function startup ():void {
    const Placeholders = document.body.querySelectorAll(
      'div[type="NoteStickers"][name]'
    )

    if (Placeholders.length === 0) {                // standalone web application
      const SerializationElement = document.querySelector(
        'script[type="NoteStickers"]'
      )
      if (SerializationElement == null) throwError(
        'MissingSerialization: no NoteSticker applet serialization found'
      )

      startApplet(SerializationElement, document.body)
    } else {                                              // embedded web applets
      Placeholders.forEach((Placeholder:any) => {
        const Name = Placeholder.getAttribute('name')
        if (! ValueIsName(Name)) {
          console.error('NoteSticker: invalid or missing applet name',Name)
          return
        }

        const SerializationElement = document.querySelector(
          'script[type="NoteStickers"][name="' + Name + '"]'
        )

        if (SerializationElement == null) {
          console.error('NoteSticker: no serialization for applet "' + Name + '" found')
        }

        startApplet(SerializationElement, Placeholder as HTMLElement)
      })
    }
  }

/**** startApplet ****/

  function startApplet (SerializationElement:any, Placeholder:HTMLElement):void {
    const Name = SerializationElement.getAttribute('name') || 'NoteSticker-Applet'
    if (Name in AppletRegistry) {
      console.error(
        'NoteSticker: multiple registration of applet "' + Name + '"'
      )
      return
    }

    let Serialization:Serializable
    try {
      Serialization = JSON.parse(SerializationElement.innerHTML)
    } catch (Signal:any) {
      console.error(
        'NoteSticker: invalid serialization for applet "' + Name + '"',
        Signal
      )
      return
    }

    let Project:SNS_Project
    try {
      Project = SNS_Project.deserializedFrom(Name,Serialization)
    } catch (Signal:any) {
      console.error(
        'NoteSticker: could not deserialize applet "' + Name + '"',
        Signal
      )
      return
    }

    const Applet:SNS_AppletObservables = AppletRegistry[Name] = observe({
      Project, chosenBoard:undefined,
      StickerList:[], selectedStickers:[], StickerSelectionGeometries:[],
      SnapToGrid:false, GridWidth:10, GridHeight:10,
      VisitHistory:[], VisitIndex:-1, View:undefined, ViewState:0,
      ConsoleIsOpen:false,
      ConsoleGeometry:{
        x:-Number.MAX_SAFE_INTEGER,y:-Number.MAX_SAFE_INTEGER, Width:320,Height:240
      },
      ConsoleValue:'', ConsoleLineCount:0, ConsoleCharCount:0,
      Application:{},                                       // will be set below
    },{ deep:false })

    Project.Application = {
      visitFirstBoard:  () => visitBoard(Applet, Applet.Project.Board(0)),
      mayVisitPrevBoard:() => (Applet.VisitIndex > 0),
      mayVisitNextBoard:() => (Applet.VisitIndex < Applet.VisitHistory.length-1),
      visitPrevBoard:visitPrevBoard.bind(null,Applet),
      visitNextBoard:visitNextBoard.bind(null,Applet),
      visitBoard:    visitBoard.bind(null,Applet),
      showConsole: showConsole.bind(null,Applet),
      hideConsole: hideConsole.bind(null,Applet),
      clearConsole:clearConsole.bind(null,Applet),
      print:  print.bind(null,Applet),
      println:println.bind(null,Applet),
    }

    Project.onChange(ProjectChangeCallback)
    Project.onRender(ProjectRenderCallback)
    Project.onError (ProjectErrorCallback)

    Project.recursivelyActivateAllScripts()

    render(html`<${AppletView} PUX=${PUX} Applet=${Applet}/>`,Placeholder)
  }


//------------------------------------------------------------------------------
//--                                AppletView                                --
//------------------------------------------------------------------------------

  class AppletView extends Component {
    public state:Indexable = { Value:0 }

    public rerender () {
      (this as Component).setState({ Value:this.state.Value+1 })
    }

    public render (PropSet:Indexable):any {
      const { PUX, Applet } = PropSet

      const me = this

      return html`<${SNS_BoardView}
        Mode="run"
        Board=${Applet.chosenBoard} StickerList=${Applet.StickerList}
        selectedStickers=${Applet.selectedStickers}
        onSelectionChange=${(selectedStickers:SNS_Sticker[]) => {
          Applet.selectedStickers = selectedStickers.slice()
          me.rerender()
        }}
        LassoMode="contain"
        onGeometryChange=${(StickerList:SNS_Sticker[],GeometryList:SNS_Geometry[]) => {
          changeStickerGeometries(StickerList,GeometryList)
          me.rerender()
        }}
        SnapToGrid=${Applet.chosenBoard?.SnapToGrid === true}
         GridWidth=${Math.round(Applet.chosenBoard?.GridWidth  || 10)}
        GridHeight=${Math.round(Applet.chosenBoard?.GridHeight || 10)}
      />
      ${Applet.ConsoleIsOpen ? html`<${ConsoleView} PUX=${PUX} Applet=${Applet}/>` : ''}`
    }
  }

//------------------------------------------------------------------------------
//--                                ConsoleView                                --
//------------------------------------------------------------------------------

  class ConsoleView extends Component {
    private _Geometry:SNS_Geometry
    private _DragRecognizer:Function|undefined
    private _DragOffset:SNS_Geometry
    private _DragMode:'drag'|'resize-sw'|'resize-s'|'resize-se'|undefined

    public state:Indexable = { Value:0 }

    public rerender () {
      (this as Component).setState({ Value:this.state.Value+1 })
    }

    public render (PropSet:Indexable):any {
      const { PUX, Applet } = PropSet

      const { ConsoleGeometry, ConsoleValue } = Applet

      let { x, y, Width, Height } = ConsoleGeometry
      let [ minWidth, maxWidth, minHeight, maxHeight ] = [120,undefined,90,undefined]

      Width = Math.max(minWidth,Width)
      if (maxWidth != null) { Width = Math.min(Width,maxWidth) }

      Height = Math.max(minHeight,Height)
      if (maxHeight != null) { Height = Math.min(Height,maxHeight) }

      if (x == -Number.MAX_SAFE_INTEGER) { x = Math.max(0,(window.innerWidth-Width)/2) }
      if (y == -Number.MAX_SAFE_INTEGER) { y = Math.max(0,(window.innerHeight-Height)/2) }

      x = Math.min(x,window.innerWidth-40)
      y = Math.max(0,Math.min(y,window.innerHeight-30))

      const my = this, me = this; my._Geometry = { x,y, Width,Height }

      const handleDrag = (x:number,y:number, dx:number,dy:number) => {
        if (my._DragMode === 'drag') {
          moveDialog(Applet, dx,dy)
        } else {
          resizeDialog(Applet, dx,dy)
        }
        Applet.View.rerender()
      }

      const moveDialog = (Applet:Indexable, dx:number,dy:number) => {
        positionAt(Applet, my._DragOffset.x + dx,my._DragOffset.y + dy)
      }

      const resizeDialog = (Applet:Indexable, dx:number,dy:number) => {
        let newWidth:number = my._Geometry.Width
        switch (my._DragMode) {
          case 'resize-sw':
            newWidth =  Math.max(minWidth,Math.min(my._DragOffset.Width-dx,maxWidth || Infinity))
              dx = newWidth-my._DragOffset.Width
            positionAt(Applet, my._DragOffset.x-dx,my._DragOffset.y)
            newWidth = my._DragOffset.Width+dx
            break
          case 'resize-se':
            newWidth = Math.max(minWidth,Math.min(my._DragOffset.Width+dx,maxWidth || Infinity))
        }
        let newHeight = Math.max(minHeight,Math.min(my._DragOffset.Height+dy,maxHeight || Infinity))
        sizeTo(Applet, newWidth,newHeight)
      }

      let DragRecognizer = my._DragRecognizer
      if (DragRecognizer == null) {
        DragRecognizer = my._DragRecognizer = DragRecognizerFor(me, {
          onlyFrom:       '.Titlebar,.leftResizer,.middleResizer,.rightResizer',
          neverFrom:      '.CloseButton',
          Threshold:      4,
          onDragStarted:  (x:number,y:number, dx:number,dy:number, Event:PointerEvent) => {
            let ClassList = (Event.target as HTMLElement).classList; my._DragMode = undefined
            switch (true) {
              case ClassList.contains('leftResizer'):   my._DragMode = 'resize-sw'; break
              case ClassList.contains('middleResizer'): my._DragMode = 'resize-s';  break
              case ClassList.contains('rightResizer'):  my._DragMode = 'resize-se'; break
              default:                                  my._DragMode = 'drag'
            }

            my._DragOffset = { ...ConsoleGeometry }
            handleDrag(x,y, dx,dy)
          },
          onDragContinued: handleDrag,
          onDragFinished:  handleDrag,
          onDragCancelled: handleDrag,
        })
      }

      function onCloseClick (Event:PointerEvent) {
        Event.stopImmediatePropagation()
        Event.preventDefault()

        Applet.ConsoleIsOpen = false
        Applet.View.rerender()
      }

      function positionAt (Applet:Indexable, x:number,y:number):void {
        x = Math.max(0, Math.min(x,window.innerWidth-40))
        y = Math.max(0, Math.min(y,window.innerHeight-30))

        Applet.ConsoleGeometry = {
          ...Applet.ConsoleGeometry, x,y
        }
        Applet.View.rerender()
      }

      function sizeTo (Applet:Indexable, Width:number,Height:number):void {
        Width  = Math.max(40,Width)
        Height = Math.max(30,Height)

        Applet.ConsoleGeometry = {
          ...Applet.ConsoleGeometry, Width,Height
        }
        Applet.View.rerender()
      }



      const CSSGeometry = (
        `left:${x}px; top:${y}px; width:${Width}px; height:${Height}px; right:auto; bottom:auto;`
      )

      return html`<div class="PUX ResizableDialog" style="
        position:fixed; ${CSSGeometry}
      " <div class="ContentPane">${ConsoleValue}</div>

        <div class="Titlebar"
          onPointerDown=${DragRecognizer} onPointerUp=${DragRecognizer}
          onPointerMove=${DragRecognizer} onPointerCancel=${DragRecognizer}
        >
          <div class="Title">Console</div>
          <img class="CloseButton" src="${PUX._ImageFolder}/xmark.png"
            onClick=${onCloseClick}/>
        </div>

        <div class="leftResizer"
          onPointerDown=${DragRecognizer} onPointerUp=${DragRecognizer}
          onPointerMove=${DragRecognizer} onPointerCancel=${DragRecognizer}
        />
        <div class="middleResizer"
          onPointerDown=${DragRecognizer} onPointerUp=${DragRecognizer}
          onPointerMove=${DragRecognizer} onPointerCancel=${DragRecognizer}
        />
        <div class="rightResizer"
          onPointerDown=${DragRecognizer} onPointerUp=${DragRecognizer}
          onPointerMove=${DragRecognizer} onPointerCancel=${DragRecognizer}
        />
      </>`
    }
  }

/**** ProjectChangeCallback ****/

  function ProjectChangeCallback (
    Project:SNS_Project, Change:SNS_Change, ...ArgList:any[]
  ):void {
    const Applet:SNS_AppletObservables = AppletRegistry[Project.Name]

    switch (Change) {
//    case 'createBoard':    // Board
//    case 'attachBoard':    // Board, Folder, Index
      case 'detachBoard':    // Board, Folder, Index
        validateVisitHistory(Applet)
        return
      case 'configureFolder': // Board, Property, Value
        switch (ArgList[0]) {
          case Applet.Project:
          case Applet.chosenBoard:
            Applet.View.rerender()
            return
          default:
            if (ArgList[0].containsFolder(Applet.chosenBoard)) {
              Applet.View.rerender()
            }
        }
        return
      case 'destroyBoard': // Board
        validateVisitHistory(Applet)
        return

//    case 'createSticker': // Sticker
      case 'attachSticker': // Sticker, Board, Index
      case 'detachSticker': // Sticker, Board, Index
        if (ArgList[1] === Applet.chosenBoard) {
          Applet.StickerList = (Applet.chosenBoard as SNS_Board).StickerList
          Applet.selectedStickers = Applet.selectedStickers.filter(
            (Sticker:SNS_Sticker) => (Sticker.Board === Applet.chosenBoard)
          )
          Applet.View.rerender()
        }
        return
      case 'configureSticker': // Sticker, Property, Value
        if (ArgList[0].Board === Applet.chosenBoard) {
          const selectedStickers = Applet.selectedStickers

          if (ArgList[1] === 'Geometry') {
            Applet.StickerSelectionGeometries = selectedStickers.map(
              (Sticker:SNS_Sticker) => Sticker.Geometry
            )
          }
          Applet.View.rerender()
        }
        return
      case 'destroySticker':   // Sticker
        if (ArgList[0].Board === Applet.chosenBoard) {
          Applet.StickerList = (Applet.chosenBoard as SNS_Board).StickerList
          Applet.selectedStickers = Applet.selectedStickers.filter(
            (Sticker:SNS_Sticker) => (Sticker.Board === Applet.chosenBoard)
          )
          Applet.View.rerender()
        }
    }
  }

/**** ProjectRenderCallback ****/

  function ProjectRenderCallback (
    Project:SNS_Project, Board:SNS_Board|undefined, Sticker:SNS_Sticker|undefined
  ):void {
    const Applet:SNS_AppletObservables = AppletRegistry[Project.Name]
    if ((Board === Applet.chosenBoard) || (Applet.chosenBoard == null)) {
      Applet.View.rerender()
    }
  }

/**** ProjectErrorCallback ****/

  function ProjectErrorCallback (
    Project:SNS_Project, Visual:SNS_Visual, Error:SNS_Error
  ):void {
    window.alert(
      Error.Type + '\n' + Error.Message + '\n' + Error.Cause
    )
  }

/**** changeStickerGeometries ****/

  function changeStickerGeometries (
    StickerList:SNS_Sticker[], GeometryList:SNS_Geometry[]
  ):void {
    const existingStickers = StickerList.filter(
      (Sticker:SNS_Sticker) => Sticker.isAttached
    )
    if (existingStickers.length === 0) throwError(
      'NoStickers: no existing stickers given'
    )

    existingStickers.forEach((Sticker:SNS_Sticker, i:number) => {
      try {
        Sticker.Geometry = GeometryList[i]
      } catch (Signal:any) { debugger /* nop */ }
    })
  }



  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', startup)
  } else {
    startup()
  }

