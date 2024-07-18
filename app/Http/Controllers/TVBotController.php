<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

/************************************
*  
*  TradingView Bot
*  
*************************************/

class TVBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);

        dd($this->request);
        
    }
    
}
