<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\DB;


/************************************
*  
*  PCSite 場景類
*  
*************************************/

class SiteController extends Controller {
    
    protected $data = [];
    protected $request;
    protected $session;
    protected $action;
    protected $method;

    public function __construct() {
    	$this->middleware(function ($request, $next) {
            
            $this->getRequest($request);
            $this->getSession();
            $this->getSegment($request);

    		return $next($request);
    	});
    }
    
    // request
    protected function getRequest($request) {
    	
    	$input = $request->input();
    	
    	foreach ($input as $k => $v) {
    		$input[$k] = trim($v);
    	}
    	
        $this->request = $input;
    }

    // session
    protected function getSession() {
        $this->session = Session::all();
    }

    // parse url and set action&method
    protected function getSegment($request) {
    	
        $action = $request->segment(1);
        if ($action == null) {
            $action = "index";
        }

        $method = $request->segment(2);
        if ($method == null) {
            $method = "index";
        }
    	
        $this->action = $action;
        $this->method = $method;

    }
    // assign
    protected function assign($key, $value) {
    	$this->data[$key] = $value;
    }
	
}
