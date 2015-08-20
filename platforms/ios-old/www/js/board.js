var Board = (function () {
    function Board() {
        this.scaleFactor = 1.0;
        this.sprites = [];
        this.backgroundColor = null;
        this.backgroundPicture = null;
        this.backgroundCamera = null;
        this._boundaryDistance = NaN;
        this._everyFrameTimer = undefined;
        this._gravity = new RT.Vector2(0, 0);
        this._worldFriction = 0;
        this._debugMode = false;
        this._lastUpdateMS = 0;
        this._lastTimeDelta = 0;
        this._startTime = 0;
        this._touched = false;
        this._touchStart = RT.Vector3.mk(0, 0, 0);
        this._touchCurrent = RT.Vector3.mk(0, 0, 0);
        this._touchEnd = RT.Vector3.mk(0, 0, 0);
        this._touchVelocity = RT.Vector3.mk(0, 0, 0);
        this._minSegments = [];
        this._walls = [];
        this._obstacles = [];
        this._springs = [];
        this._backgroundScene = undefined;
        this.swipeThreshold = 10;
        this.dragThreshold = 5;
        this.onTap = new RT.Event_();
        this.onTouchDown = new RT.Event_();
        this.onTouchUp = new RT.Event_();
        this.onSwipe = new RT.Event_();
        this._touchPrevious = RT.Vector3.mk(0, 0, 0);
        this._touchDirection = RT.Vector3.mk(0, 0, 0);
        this.tick = 0;
        this._everyFrameOnSprite = false;
    }
    Board.mk = function (rt, landscape, w, h, full) {
        var b = new Board();
        b._landscape = landscape;
        b._width = w;
        b._height = h;
        b._full = full;
        b._startTime = rt.currentTime();
        b.backgroundColor = RT.Colors.transparent();
        b.init(rt);
        return b;
    };
    Board.prototype.init = function (rt) {
        var _this = this;
        this._runtime = rt;
        this.canvas = document.createElement("canvas");
        this.canvas.className = "boardCanvas";
        this.updateScaleFactor();
        this.container = TDev.div("boardContainer", this.canvas);
        this.ctx = this.canvas.getContext("2d");
        this.container.setChildren([this.canvas]);
        this.container.updateSizes = function () {
            _this.updateScaleFactor();
            _this.redrawBoardAndContents();
        };
        var handler = new TDev.TouchHandler(this.canvas, function (e, x, y) {
            _this.touchHandler(e, x, y);
        });
    };
    Board.prototype.updateScaleFactor = function () {
        TDev.Util.assert(!!this._runtime);
        if (!this._runtime)
            return;
        var s0;
        var s1;
        if (this._full) {
            s0 = this._runtime.host.fullWallWidth() / this._width;
            s1 = this._runtime.host.fullWallHeight() / this._height;
        }
        else {
            var w = this._runtime.host.wallWidth;
            if (this.container && this.container.offsetWidth)
                w = this.container.offsetWidth;
            s0 = w / this._width;
            s1 = this._runtime.host.wallHeight / this._height;
        }
        if (s0 > s1)
            s0 = s1;
        var ww = this._width * s0;
        var hh = this._height * s0;
        this.scaleFactor = s0;
        this.canvas.width = ww * TDev.SizeMgr.devicePixelRatio;
        this.canvas.height = hh * TDev.SizeMgr.devicePixelRatio;
        this.canvas.style.width = ww + "px";
        this.canvas.style.height = hh + "px";
        if (this._full) {
            var topMargin = (this._runtime.host.fullWallHeight() - hh) / 2;
            this.canvas.style.marginTop = topMargin + "px";
        }
    };
    Board.prototype.touchHandler = function (e, x, y) {
        TDev.Util.assert(!!this._runtime);
        if (!this._runtime)
            return;
        x = Math.round(x / this.scaleFactor);
        y = Math.round(y / this.scaleFactor);
        switch (e) {
            case "down":
                this._touched = true;
                this._touchPrevious = this._touchCurrent = this._touchLast = this._touchStart = RT.Vector3.mk(x, y, 0);
                this._touchedSpriteStack = this.findTouchedSprites(x, y);
                this._prevTouchTime = this._runtime.currentTime();
                this._touchDeltaTime = 0;
                this._touchDirection = RT.Vector3.mk(0, 0, 0);
                this.queueTouchDown(this._touchedSpriteStack, [x, y]);
                this._runtime.queueBoardEvent(["touch down: "], [this], [x, y]);
                if (!!this._touchedSpriteStack) {
                    this._runtime.queueBoardEvent(["touch over "], this._touchedSpriteStack, [x, y], true, true);
                }
                break;
            case "move":
                this._touchCurrent = RT.Vector3.mk(x, y, 0);
                var now = this._runtime.currentTime();
                var deltaMove = this._touchCurrent.subtract(this._touchPrevious);
                var deltaTime = now - this._prevTouchTime;
                if (deltaTime > 50 || deltaMove.length() > 20) {
                    this._touchDirection = deltaMove;
                    this._touchDeltaTime = deltaTime;
                }
                if (!!this._touchedSpriteStack) {
                    var dist = this._touchCurrent.subtract(this._touchLast);
                    if (dist.length() > this.dragThreshold) {
                        this._touchLast = this._touchCurrent;
                        this.queueDrag(this._touchedSpriteStack, [x, y, dist._x, dist._y]);
                        this._runtime.queueBoardEvent(["drag sprite in ", "drag sprite: "], this._touchedSpriteStack, [x, y, dist._x, dist._y]);
                    }
                }
                var currentStack = this.findTouchedSprites(x, y);
                if (!!currentStack) {
                    this._runtime.queueBoardEvent(["touch over "], currentStack, [x, y], true, true);
                }
                break;
            case "up":
                var currentPoint = RT.Vector3.mk(x, y, 0);
                this._touchEnd = this._touchCurrent = currentPoint;
                this._touched = false;
                if (this._touchDeltaTime > 0) {
                    this._touchVelocity = this._touchDirection.scale(1000 / this._touchDeltaTime);
                }
                else {
                    this._touchVelocity = RT.Vector3.mk(0, 0, 0);
                }
                var dist = this._touchEnd.subtract(this._touchStart);
                var stack = this._touchedSpriteStack;
                if (!stack) {
                    stack = [];
                }
                stack.push(this);
                if (dist.length() > this.swipeThreshold) {
                    this.queueSwipe(this._touchedSpriteStack, [this._touchStart._x, this._touchStart._y, dist._x, dist._y]);
                    this._runtime.queueBoardEvent(["swipe sprite in ", "swipe sprite: ", "swipe board: "], stack, [this._touchStart._x, this._touchStart._y, dist._x, dist._y]);
                }
                else {
                    this.queueTap(this._touchedSpriteStack, [x, y]);
                    this._runtime.queueBoardEvent(["tap sprite in ", "tap sprite: ", "tap board: "], stack, [x, y]);
                }
                this.queueTouchUp(this._touchedSpriteStack, [x, y]);
                this._runtime.queueBoardEvent(["touch up: "], [this], [x, y]);
                break;
        }
    };
    Board.prototype.queueDrag = function (stack, args) {
        if (!stack)
            return false;
        for (var i = 0; i < stack.length; i++) {
            var sprite = stack[i];
            if (sprite instanceof Board)
                continue;
            if (sprite.onDrag.handlers) {
                this._runtime.queueLocalEvent(sprite.onDrag, args);
                return true;
            }
        }
        return false;
    };
    Board.prototype.queueTouchDown = function (stack, args) {
        if (stack && stack.length > 0) {
            for (var i = 0; i < stack.length; i++) {
                var sprite = stack[i];
                if (sprite instanceof Board)
                    continue;
                if (sprite.onTouchDown.handlers) {
                    this._runtime.queueLocalEvent(sprite.onTouchDown, args);
                    return true;
                }
            }
        }
        else {
            if (this.onTouchDown.handlers) {
                this._runtime.queueLocalEvent(this.onTouchDown, args);
                return true;
            }
        }
        return false;
    };
    Board.prototype.queueTouchUp = function (stack, args) {
        if (stack && stack.length > 0) {
            for (var i = 0; i < stack.length; i++) {
                var sprite = stack[i];
                if (sprite instanceof Board)
                    continue;
                if (sprite.onTouchUp.handlers) {
                    this._runtime.queueLocalEvent(sprite.onTouchUp, args);
                    return true;
                }
            }
        }
        else {
            if (this.onTouchUp.handlers) {
                this._runtime.queueLocalEvent(this.onTouchUp, args);
                return true;
            }
        }
        return false;
    };
    Board.prototype.queueTap = function (stack, args) {
        if (stack && stack.length > 0) {
            for (var i = 0; i < stack.length; i++) {
                var sprite = stack[i];
                if (sprite instanceof Board)
                    continue;
                if (sprite.onTap.handlers) {
                    this._runtime.queueLocalEvent(sprite.onTap, args);
                    return true;
                }
            }
        }
        if (this.onTap.handlers) {
            this._runtime.queueLocalEvent(this.onTap, args);
            return true;
        }
        return false;
    };
    Board.prototype.queueSwipe = function (stack, args) {
        if (stack && stack.length > 0) {
            for (var i = 0; i < stack.length; i++) {
                var sprite = stack[i];
                if (sprite instanceof Board)
                    continue;
                if (sprite.onSwipe.handlers) {
                    this._runtime.queueLocalEvent(sprite.onSwipe, args);
                    return true;
                }
            }
        }
        else {
            if (this.onSwipe.handlers) {
                this._runtime.queueLocalEvent(this.onSwipe, args);
                return true;
            }
        }
        return false;
    };
    Board.prototype.findTouchedSprites = function (x, y) {
        var candidates = this.orderedSprites().filter(function (sp) { return !sp._hidden && sp.contains(x, y); }).reverse();
        if (candidates.length == 0)
            return undefined;
        return candidates;
    };
    Board.prototype.applyBackground = function () {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this._width, this._height);
        if (!!this.backgroundCamera) {
        }
        else if (!!this.backgroundPicture && this.backgroundPicture.hasCanvas()) {
            this.ctx.drawImage(this.backgroundPicture.getCanvas(), 0, 0, this.backgroundPicture.widthSync(), this.backgroundPicture.heightSync(), 0, 0, this._width, this._height);
        }
        else if (!!this.backgroundColor) {
            this.ctx.fillStyle = this.backgroundColor.toHtml();
            this.ctx.fillRect(0, 0, this._width, this._height);
        }
        if (this._backgroundScene)
            this._backgroundScene.render(this._width, this._height, this.ctx);
        this.ctx.restore();
    };
    Board.prototype.height = function () {
        return this._height;
    };
    Board.prototype.count = function () {
        return this.sprites.length;
    };
    Board.prototype.get_enumerator = function () {
        return this.sprites.slice(0);
    };
    Board.prototype.width = function () {
        return this._width;
    };
    Board.prototype.touched = function () {
        return this._touched;
    };
    Board.prototype.touch_start = function () {
        return this._touchStart;
    };
    Board.prototype.touch_current = function () {
        return this._touchCurrent;
    };
    Board.prototype.touch_end = function () {
        return this._touchEnd;
    };
    Board.prototype.touch_velocity = function () {
        return this._touchVelocity;
    };
    Board.prototype.create_boundary = function (distance) {
        if (!isNaN(this._boundaryDistance))
            return;
        this._boundaryDistance = distance;
        this.initializeCanvasBoundaries(distance);
    };
    Board.prototype.initializeCanvasBoundaries = function (distance) {
        if (isNaN(distance))
            return;
        this._walls.push(WallSegment.mk(-distance, -distance, this.width() + 2 * distance, 0, 1, 0));
        this._walls.push(WallSegment.mk(this.width() + distance, -distance, 0, this.height() + 2 * distance, 1, 0));
        this._walls.push(WallSegment.mk(this.width() + distance, this.height() + distance, -(this.width() + 2 * distance), 0, 1, 0));
        this._walls.push(WallSegment.mk(-distance, this.height() + distance, 0, -(this.height() + 2 * distance), 1, 0));
    };
    Board.prototype.addObstacle = function (o) {
        this._walls.push(WallSegment.mk(o.x, o.y, o.xextent, o.yextent, o.elasticity, o.friction, o));
        this._walls.push(WallSegment.mk(o.x + o.xextent, o.y + o.yextent, -o.xextent, -o.yextent, o.elasticity, o.friction, o));
        this._obstacles.push(o);
    };
    Board.prototype.create_sprite_set = function () {
        return new RT.SpriteSet();
    };
    Board.prototype.deleteSprite = function (sprite) {
        var idx = this.sprites.indexOf(sprite);
        if (idx < 0)
            return;
        this.sprites.splice(idx, 1);
        this.spritesChanged();
    };
    Board.prototype.spritesChanged = function () {
        this._orderedSprites = undefined;
    };
    Board.prototype.frame_timer = function (s) {
        if (!this._everyFrameTimer)
            this._everyFrameTimer = new RT.Timer(s.rt, 0.02, false);
        return this._everyFrameTimer;
    };
    Board.prototype.add_on_every_frame = function (body, s) {
        return this.on_every_frame(body, s);
    };
    Board.prototype.on_every_frame = function (body, s) {
        return this.frame_timer(s).on_trigger(body);
    };
    Board.prototype.clear_every_frame_timers = function () {
        if (this._everyFrameTimer) {
            this._everyFrameTimer.clear();
            this._everyFrameTimer = undefined;
            this._everyFrameOnSprite = false;
        }
    };
    Board.prototype.on_tap = function (tapped) {
        return this.onTap.addHandler(tapped);
    };
    Board.prototype.on_swipe = function (swiped) {
        return this.onSwipe.addHandler(swiped);
    };
    Board.prototype.on_touch_down = function (touch_down) {
        return this.onTouchDown.addHandler(touch_down);
    };
    Board.prototype.on_touch_up = function (touch_up) {
        return this.onTouchUp.addHandler(touch_up);
    };
    Board.prototype.evolve = function () {
        var _this = this;
        TDev.Util.assert(!!this._runtime);
        if (!this._runtime)
            return;
        this.tick++;
        if (isNaN(this.tick))
            this.tick = 0;
        var now = this._runtime.currentTime();
        var newDelta = this._lastTimeDelta = (now - this._startTime) - this._lastUpdateMS;
        this._lastUpdateMS += newDelta;
        var dT = RT.Math_.clamp(0, 0.2, newDelta / 1000);
        this.sprites.forEach(function (sprite) { return sprite.update(dT); });
        this.detectCollisions(dT);
        this.sprites.forEach(function (sprite) { return sprite.commitUpdate(_this._runtime, dT); });
    };
    Board.prototype.detectCollisions = function (dT) {
        for (var i = 0; i < this.sprites.length; i++) {
            var s = this.sprites[i];
            if (!!s._location)
                continue;
            this.detectWallCollision(s, dT);
        }
    };
    Board.prototype.detectWallCollision = function (sprite, dT) {
        sprite.normalTouchPoints.clear();
        for (var i = 0; i < this._walls.length; i++) {
            var wall = this._walls[i];
            if (wall.processPotentialCollision(sprite, dT) && wall._obstacle)
                wall._obstacle.raiseCollision(this._runtime, sprite);
        }
        for (var i = 0; i < this._walls.length; i++) {
            var wall = this._walls[i];
            if (wall.processPotentialCollision(sprite, dT) && wall._obstacle)
                wall._obstacle.raiseCollision(this._runtime, sprite);
        }
    };
    Board.prototype.updateViewCore = function (s, b) {
        if (b instanceof TDev.WallBox)
            b.fullScreen = this._full;
        this.redrawBoardAndContents();
    };
    Board.prototype.getViewCore = function (s, b) {
        this._touched = false;
        return this.container;
    };
    Board.prototype.equals = function (other_board) {
        return this == other_board;
    };
    Board.prototype.background_scene = function () {
        if (!this._backgroundScene)
            this._backgroundScene = new RT.BoardBackgroundScene(this);
        return this._backgroundScene;
    };
    Board.prototype.set_background = function (color) {
        this.backgroundCamera = null;
        this.backgroundColor = color;
        this.backgroundPicture = null;
    };
    Board.prototype.set_background_camera = function (camera) {
        this.backgroundCamera = camera;
        this.backgroundColor = null;
        this.backgroundPicture = null;
    };
    Board.prototype.set_background_picture = function (picture, r) {
        this.backgroundCamera = null;
        this.backgroundColor = null;
        this.backgroundPicture = picture;
        picture.loadFirst(r, null);
    };
    Board.prototype.set_debug_mode = function (debug) {
        this._debugMode = debug;
    };
    Board.prototype.set_friction = function (friction) {
        this._worldFriction = friction;
    };
    Board.prototype.is_landscape = function () {
        return this._landscape;
    };
    Board.prototype.set_gravity = function (x, y) {
        this._gravity = new RT.Vector2(x, y);
    };
    Board.prototype.gravity = function () {
        return this._gravity;
    };
    Board.prototype.at = function (i) {
        return this.sprites[i];
    };
    Board.prototype.initialX = function () {
        return this.width() / 2;
    };
    Board.prototype.initialY = function () {
        return this.height() / 2;
    };
    Board.prototype.enableEveryFrameOnSprite = function (s) {
        var _this = this;
        if (this._everyFrameOnSprite)
            return;
        this._everyFrameOnSprite = true;
        var handler = function (bot, prev) {
            var q = _this._runtime.eventQ;
            var args = [];
            _this.sprites.forEach(function (s) {
                if (s.onEveryFrame.pendinghandlers == 0)
                    q.addLocalEvent(s.onEveryFrame, args);
            });
            bot.entryAddr = prev;
            return bot;
        };
        this.on_every_frame(handler, s);
    };
    Board.prototype.update_on_wall = function () {
        this.redrawBoardAndContents();
    };
    Board.prototype.orderedSprites = function () {
        if (!this._orderedSprites) {
            this._orderedSprites = this.sprites.slice(0);
            this._orderedSprites.stableSort(function (a, b) { return a.z_index() - b.z_index(); });
        }
        return this._orderedSprites;
    };
    Board.prototype.redrawBoardAndContents = function () {
        var _this = this;
        var isDebugMode = this._debugMode && (this._runtime && !this._runtime.currentScriptId);
        this.ctx.save();
        var scale = this.scaleFactor * TDev.SizeMgr.devicePixelRatio;
        this.ctx.scale(scale, scale);
        this.applyBackground();
        this.orderedSprites().forEach(function (s) { return s.redraw(_this.ctx, isDebugMode); });
        this.renderObstacles();
        if (isDebugMode) {
            this.debugGrid();
            this.debugSprings();
            this.debugSegments();
        }
        this.ctx.restore();
    };
    Board.prototype.renderingContext = function () {
        return this.ctx;
    };
    Board.prototype.debugGrid = function () {
        this.ctx.save();
        this.ctx.beginPath();
        var w = this.width();
        var h = this.height();
        this.ctx.strokeStyle = "rgba(90, 90, 90, 0.7)";
        this.ctx.fillStyle = "rgba(90, 90, 90, 0.7)";
        this.ctx.lineWidth = 1;
        this.ctx.font = "12px sans-serif";
        for (var y = 0; y <= h; y += 100) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            if (y > 0 && y % 100 == 0)
                this.ctx.fillText(y.toString(), 2, y - 5);
            this.ctx.stroke();
        }
        for (var x = 0; x <= w; x += 100) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            if (x > 0 && x % 100 == 0)
                this.ctx.fillText(x.toString(), x - 15, 10);
            this.ctx.stroke();
        }
        this.ctx.restore();
    };
    Board.prototype.debugSegments = function () {
        this.ctx.save();
        this.ctx.beginPath();
        for (var i = 0; i < this._minSegments.length; ++i) {
            var seg = this._minSegments[i];
            if (seg.overlap) {
                this.ctx.fillStyle = "green";
                this.ctx.strokeStyle = "green";
            }
            else {
                this.ctx.fillStyle = "red";
                this.ctx.strokeStyle = "red";
            }
            this.ctx.font = "20px sans-serif";
            this.ctx.lineWidth = 4;
            this.ctx.moveTo(seg.x(), seg.y());
            this.ctx.lineTo(seg.x() + seg.z(), seg.y() + seg.w());
            this.ctx.fillText(seg.from + "", seg.x() + seg.z(), seg.y() + seg.w());
        }
        this.ctx.stroke();
        this.ctx.restore();
        if (this._minSegments.length > 0) {
            debugger;
            this._minSegments = [];
        }
    };
    Board.prototype.debugSprings = function () {
        this.ctx.save();
        this.ctx.strokeStyle = "gray";
        this.ctx.beginPath();
        for (var i = 0; i < this._springs.length; i++) {
            var o = this._springs[i];
            this.ctx.moveTo(o.sprite1.x(), o.sprite1.y());
            this.ctx.lineTo(o.sprite2.x(), o.sprite2.y());
        }
        this.ctx.stroke();
        this.ctx.restore();
    };
    Board.prototype.renderObstacles = function () {
        this.ctx.save();
        for (var i = 0; i < this._obstacles.length; i++) {
            var o = this._obstacles[i];
            if (!o.isValid())
                continue;
            this.ctx.beginPath();
            this.ctx.lineWidth = o._thickness;
            this.ctx.strokeStyle = o._color.toHtml();
            this.ctx.moveTo(o.x, o.y);
            this.ctx.lineTo(o.x + o.xextent, o.y + o.yextent);
            this.ctx.stroke();
        }
        this.ctx.restore();
    };
    Board.prototype.mkSprite = function (tp, w, h) {
        var s = RT.Sprite.mk(tp, this.initialX(), this.initialY(), w, h);
        this.addSprite(s);
        return s;
    };
    Board.prototype.addSprite = function (s) {
        s._parent = this;
        s.set_z_index(0);
        this.sprites.push(s);
        s.changed();
        this.spritesChanged();
    };
    Board.prototype.create_ellipse = function (width, height) {
        return this.mkSprite(0 /* Ellipse */, width, height);
    };
    Board.prototype.create_rectangle = function (width, height) {
        return this.mkSprite(1 /* Rectangle */, width, height);
    };
    Board.prototype.create_text = function (width, height, fontSize, text) {
        var s = this.mkSprite(2 /* Text */, width, height);
        s.fontSize = fontSize;
        s.set_text(text);
        return s;
    };
    Board.prototype.create_picture = function (picture, r) {
        var s = this.mkSprite(3 /* Picture */, 1, 1);
        picture.loadFirst(r, function () {
            s.setPictureInternal(picture);
            return s;
        });
    };
    Board.prototype.create_sprite_sheet = function (picture, r) {
        var _this = this;
        picture.loadFirst(r, function () {
            TDev.Util.log('board: new sprite sheet - ' + picture.widthSync() + 'x' + picture.heightSync());
            var sheet = new RT.SpriteSheet(_this, picture);
            return sheet;
        });
    };
    Board.prototype.create_anchor = function (width, height) {
        var anchor = this.mkSprite(4 /* Anchor */, width, height);
        anchor.set_friction(1);
        anchor.hide();
        return anchor;
    };
    Board.prototype.create_obstacle = function (x, y, width, height, elasticity) {
        if (width == 0 && height == 0)
            return;
        var o = new Obstacle(this, x, y, width, height, elasticity, 1 - elasticity);
        this.addObstacle(o);
        return o;
    };
    Board.prototype.deleteObstacle = function (obstacle) {
        var idx = this._obstacles.indexOf(obstacle);
        if (idx > -1) {
            this._obstacles.splice(idx, 1);
            this._walls = this._walls.filter(function (wall) { return wall._obstacle != obstacle; });
        }
    };
    Board.prototype.create_spring = function (sprite1, sprite2, stiffness) {
        var spring = new RT.Spring(this, sprite1, sprite2, stiffness);
        this._springs.push(spring);
        sprite1.addSpring(spring);
        sprite2.addSpring(spring);
        return spring;
    };
    Board.prototype.deleteSpring = function (spring) {
        spring.sprite1.removeSpring(spring);
        spring.sprite2.removeSpring(spring);
        var idx = this._springs.indexOf(spring);
        if (idx > -1)
            this._springs.splice(idx, 1);
    };
    Board.prototype.clear_events = function () {
    };
    Board.prototype.overlapWithAny = function (sprite, sprites) {
        var result = new RT.SpriteSet();
        for (var i = 0; i < sprites.count(); i++) {
            var other = sprites.at(i);
            if (sprite === other)
                continue;
            if (sprite.overlaps_with(other)) {
                result.add(other);
            }
        }
        return result;
    };
    Board.prototype.clear_background_camera = function () {
        this.backgroundCamera = null;
    };
    Board.prototype.clear_background_picture = function () {
        this.backgroundPicture = null;
    };
    Board.prototype.post_to_wall = function (s) {
        _super.prototype.post_to_wall.call(this, s);
        if (this._full) {
            if (this._landscape)
                TDev.Runtime.lockOrientation(false, true, false);
            else
                TDev.Runtime.lockOrientation(true, false, false);
        }
    };
    return Board;
})();