<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;

use App\Models\Test;
/************************************
*  
*  TradingView Bot
*  
*************************************/

class TgBotController extends SiteController {
   
    // 首頁
    public function index(Request $request) {
    	
        $this->getRequest($request);

        $reponse = json_encode($this->request);

        $data = Test::create([
            "data" => $reponse
        ]);
        
        
    }
    
}
